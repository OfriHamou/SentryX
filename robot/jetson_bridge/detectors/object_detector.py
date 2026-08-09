#!/usr/bin/env python3
"""
Yahboom Object Detector

Reuses the TensorFlow model and detection logic from:
/home/jetson/Notebooks/English/12.Object_recognition/Object_recognition.ipynb

Limitation: The Yahboom COCO model detects common objects (people, chairs, tables, etc.)
but will NOT detect walls, glass surfaces, ledges, or every physical obstacle.
Use real walls and tall objects as obstacles for testing.
"""

import os
import numpy as np
import tensorflow as tf
import cv2


class YahboomObjectDetector(object):
    """
    TensorFlow-based object detector using Yahboom's pre-trained COCO model.
    
    The model is loaded once and persists for the lifetime of the detector.
    A single TensorFlow session handles all inference.
    """
    
    def __init__(self, model_path, label_path):
        """
        Initialize the detector.
        
        Args:
            model_path: Path to frozen TensorFlow model (.pb file)
            label_path: Path to COCO label map file
            
        Raises:
            IOError: If model or label files don't exist or fail to load
        """
        self.model_path = model_path
        self.label_path = label_path
        
        self.session = None
        self.detection_graph = None
        self.label_map = {}
        self.model_loaded = False
        self.load_error = None
        
        try:
            self._load_label_map()
            self._load_graph()
            self.model_loaded = True
        except Exception as e:
            self.model_loaded = False
            self.load_error = str(e)
            raise IOError("Failed to load object detector: {}".format(e))
    
    def _load_label_map(self):
        """Load TensorFlow COCO .pbtxt label map."""
        if not os.path.exists(self.label_path):
            raise IOError("Label map not found: {}".format(self.label_path))

        try:
            current_id = None
            current_name = None

            with open(self.label_path, 'r') as f:
                for raw_line in f:
                    line = raw_line.strip()

                    if line.startswith("id:"):
                        current_id = int(line.split(":", 1)[1].strip())

                    elif line.startswith("display_name:"):
                        current_name = line.split(":", 1)[1].strip().strip('"')

                    elif line == "}":
                        if current_id is not None and current_name:
                            self.label_map[current_id] = current_name

                        current_id = None
                        current_name = None

        except Exception as e:
            raise IOError("Failed to load label map: {}".format(e))

    def _load_graph(self):
        """Load and initialize TensorFlow graph and session."""
        if not os.path.exists(self.model_path):
            raise IOError("Model not found: {}".format(self.model_path))
        
        try:
            self.detection_graph = tf.Graph()
            with self.detection_graph.as_default():
                od_graph_def = tf.compat.v1.GraphDef()
                with tf.compat.v1.gfile.GFile(self.model_path, 'rb') as fid:
                    serialized_graph = fid.read()
                    od_graph_def.ParseFromString(serialized_graph)
                    tf.import_graph_def(od_graph_def, name='')
            
            # Create TensorFlow session with Jetson-friendly limits
            config = tf.compat.v1.ConfigProto()
            config.device_count['GPU'] = 0
            config.gpu_options.allow_growth = True
            config.intra_op_parallelism_threads = 1
            config.inter_op_parallelism_threads = 1

            self.session = tf.compat.v1.Session(
                graph=self.detection_graph,
                config=config
            )
        except Exception as e:
            raise IOError("Failed to load TensorFlow model: {}".format(e))
    
    def detect(self, frame):
        """
        Run object detection on a frame.
        
        Args:
            frame: OpenCV BGR image (numpy array)
            
        Returns:
            List of detections, each with:
            {
                "name": "chair",
                "class_id": 62,
                "score": 0.81,
                "box": {
                    "ymin": 0.20,
                    "xmin": 0.25,
                    "ymax": 0.92,
                    "xmax": 0.80
                }
            }
        """
        if not self.model_loaded or self.session is None:
            return []
        
        try:
            # Prepare input at a smaller resolution to reduce Jetson GPU memory usage.
            # Detection boxes are normalized, so obstacle-position logic still works.
            image_np = cv2.resize(frame, (300, 300))
            image_np_expanded = np.expand_dims(image_np, axis=0)
            
            # Get input/output tensors
            image_tensor = self.detection_graph.get_tensor_by_name('image_tensor:0')
            detection_boxes = self.detection_graph.get_tensor_by_name('detection_boxes:0')
            detection_scores = self.detection_graph.get_tensor_by_name('detection_scores:0')
            detection_classes = self.detection_graph.get_tensor_by_name('detection_classes:0')
            
            # Run inference
            (boxes, scores, classes) = self.session.run(
                [detection_boxes, detection_scores, detection_classes],
                feed_dict={image_tensor: image_np_expanded}
            )
            
            # Convert to normalized coordinates
            detections = []
            boxes = np.squeeze(boxes)
            scores = np.squeeze(scores)
            classes = np.squeeze(classes)
            
            for i in range(len(scores)):
                score = float(scores[i])
                class_id = int(classes[i])
                
                # Skip low-confidence detections
                if score < 0.1:
                    break
                
                box = boxes[i]
                detection = {
                    "name": self.label_map.get(class_id, "Unknown"),
                    "class_id": class_id,
                    "score": round(score, 3),
                    "box": {
                        "ymin": round(float(box[0]), 3),
                        "xmin": round(float(box[1]), 3),
                        "ymax": round(float(box[2]), 3),
                        "xmax": round(float(box[3]), 3)
                    }
                }
                detections.append(detection)
            
            return detections
        
        except Exception as e:
            # Don't crash on inference error; return empty list
            # Caller should check and shut down
            return []
    
    def is_forward_obstacle(self, detection):
        """
        Determine if a detection represents an obstacle directly in front.
        
        Rules:
        - Score >= 0.50
        - Object near horizontal center (center_x in [0.20, 0.80])
        - Object in lower half of image (ymax >= 0.50)
        - Bounding box large enough to indicate closeness (area >= 0.08)
        
        Args:
            detection: Single detection dict from detect()
            
        Returns:
            Boolean
        """
        box = detection.get("box", {})
        
        # Extract normalized box coordinates
        ymin = float(box.get("ymin", 0.0))
        xmin = float(box.get("xmin", 0.0))
        ymax = float(box.get("ymax", 1.0))
        xmax = float(box.get("xmax", 1.0))
        
        # Calculate center and area
        center_x = (xmin + xmax) / 2.0
        box_area = max(0.0, xmax - xmin) * max(0.0, ymax - ymin)
        
        # Check all conditions
        score_ok = detection.get("score", 0.0) >= 0.50
        center_ok = 0.20 <= center_x <= 0.80
        ymax_ok = ymax >= 0.50
        area_ok = box_area >= 0.08
        
        return score_ok and center_ok and ymax_ok and area_ok
    
    def shutdown(self):
        """Clean up TensorFlow session."""
        if self.session is not None:
            self.session.close()
            self.session = None
    
    def __del__(self):
        """Ensure cleanup on garbage collection."""
        self.shutdown()
