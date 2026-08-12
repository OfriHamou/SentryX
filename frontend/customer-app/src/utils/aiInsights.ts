export interface DetectedPerson
{
    apparentGender?: string;
    estimatedAgeGroup?: string;
    apparentAgeYears?: number;
    skinToneDescription?: string;
    isFaceCovered?: boolean;
    faceCoveringType?: string;
    headwear?: string;
    isSafetyVestWorn?: boolean;
    clothingUpperColor?: string;
    facialExpression?: string;
    postureState?: string;
}

export interface AiFrameAnalysis
{
    peopleCount: number;
    detectedPeople: DetectedPerson[];
    engineName?: string;
}

function asString(value: unknown): string | undefined
{
    if (typeof value !== 'string') 
    {
        return undefined;
    }

    const trimmed = value.trim();

    if (trimmed.length > 0) 
    {
        return trimmed;
    }
    else 
    {
        return undefined;
    }
}

function asBoolean(value: unknown): boolean | undefined
{
    if (typeof value === 'boolean') 
    {
        return value;
    }
    else 
    {
        return undefined;
    }
}

function asNumber(value: unknown): number | undefined
{
    if (typeof value === 'number' && Number.isFinite(value)) 
    {
        return value;
    }
    else 
    {
        return undefined;
    }
}

function asRecord(value: unknown): Record<string, unknown> | undefined
{
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) 
    {
        return value as Record<string, unknown>;
    }
    else 
    {
        return undefined;
    }
}

function toDetectedPerson(rawPerson: unknown): DetectedPerson
{
    let fields: Record<string, unknown> = {};
    const parsed = asRecord(rawPerson);

    if (parsed) 
    {
        fields = parsed;
    }

    return {
        apparentGender: asString(fields.apparent_gender),
        estimatedAgeGroup: asString(fields.estimated_age_group),
        apparentAgeYears: asNumber(fields.apparent_age_years),
        skinToneDescription: asString(fields.skin_tone_description),
        isFaceCovered: asBoolean(fields.face_covering),
        faceCoveringType: asString(fields.face_covering_type),
        headwear: asString(fields.headwear),
        isSafetyVestWorn: asBoolean(fields.safety_vest_worn),
        clothingUpperColor: asString(fields.clothing_upper_color),
        facialExpression: asString(fields.facial_expression),
        postureState: asString(fields.posture_state),
    };
}

// ai_metadata reaches the frontend in one of three shapes:
// object - the normal case: the worker writes jsonb, TypeORM returns an object
// null   - the event was never analyzed (PENDING/PROCESSING) or the analysis failed
// string - not expected, but the admin app guards for it, so we do too
export function parseAiFrameAnalysis(rawMetadata: unknown): AiFrameAnalysis | null
{
    let metadata = rawMetadata;

    if (typeof metadata === 'string') 
    {
        try 
        {
            metadata = JSON.parse(metadata);
        }
        catch 
        {
            return null;
        }
    }

    const analysis = asRecord(metadata);

    if (!analysis) 
    {
        return null;
    }

    if (!Array.isArray(analysis.individuals)) 
    {
        return null;
    }

    const detectedPeople = analysis.individuals.map(toDetectedPerson);

    return {
        peopleCount: asNumber(analysis.people_count) ?? detectedPeople.length,
        detectedPeople,
        engineName: asString(analysis.engine),
    };
}

const CLOTHING_COLOR_TO_HEX: Record<string, string> =
{
    black: '#111827',
    white: '#F9FAFB',
    grey: '#9CA3AF',
    gray: '#9CA3AF',
    red: '#EF4444',
    orange: '#F97316',
    yellow: '#EAB308',
    green: '#22C55E',
    blue: '#3B82F6',
    purple: '#A855F7',
    pink: '#EC4899',
    brown: '#92400E',
};

const UNKNOWN_CLOTHING_COLOR_HEX = '#9CA3AF';

// The model returns free text such as "black" or "dark blue", so match on keywords
// rather than on the whole string.
export function clothingColorToHex(clothingColor?: string): string
{
    if (!clothingColor) 
    {
        return UNKNOWN_CLOTHING_COLOR_HEX;
    }

    const normalized = clothingColor.toLowerCase();
    const matchedColorName = Object.keys(CLOTHING_COLOR_TO_HEX).find((colorName) => normalized.includes(colorName));

    if (matchedColorName) 
    {
        return CLOTHING_COLOR_TO_HEX[matchedColorName];
    }
    else 
    {
        return UNKNOWN_CLOTHING_COLOR_HEX;
    }
}