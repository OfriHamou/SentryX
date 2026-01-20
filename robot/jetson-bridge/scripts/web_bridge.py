#!/usr/bin/env python3
import rospy
from geometry_msgs.msg import Twist
from flask import Flask, request

# 1) Start a ROS node (this program becomes a "ROS node")
rospy.init_node('web_bridge')

# 2) Create a publisher to /cmd_vel
cmd_vel_pub = rospy.Publisher('/cmd_vel', Twist, queue_size=10)

# 3) Start a small HTTP server
app = Flask(__name__)

@app.route('/api/move', methods=['POST'])
def move_robot():
    data = request.json or {}

    # Build a Twist message (standard ROS movement message)
    twist = Twist()
    twist.linear.x = float(data.get('speed', 0.0))
    twist.angular.z = float(data.get('rotation', 0.0))

    # Publish the message to ROS
    cmd_vel_pub.publish(twist)

    return {'status': 'moving'}

if __name__ == '__main__':
    # Listen on all interfaces so your PC can reach it
    app.run(host='0.0.0.0', port=5000)
