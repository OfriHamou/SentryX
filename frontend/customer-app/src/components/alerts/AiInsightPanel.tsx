import { Box, Chip, CircularProgress, Paper, Stack, Typography, Alert as MuiAlert } from '@mui/material';
import { Face as FaceIcon, Masks as MasksIcon, HealthAndSafety as VestIcon, Checkroom as ClothingIcon,  Accessibility as PostureIcon, SentimentSatisfiedAlt as ExpressionIcon, Palette as SkinToneIcon} from '@mui/icons-material';
import type { ReactElement } from 'react';
import { parseAiFrameAnalysis, clothingColorToHex, type DetectedPerson } from '../../utils/aiInsights';

interface AiInsightPanelProps
{
    aiMetadata: unknown;
    eventStatus?: string;
}

interface PersonTag
{
    label: string;
    icon: ReactElement;
    isAlerting: boolean;
}

const TAG_TONES =
{
    neutral: { color: '#374151', background: '#F3F4F6' },
    alerting: { color: '#B45309', background: '#FEF6E7' },
};

function buildPersonHeadline(person: DetectedPerson): string
{
    const parts: string[] = [];

    if (person.apparentGender) parts.push(person.apparentGender);
    if (person.estimatedAgeGroup) parts.push(person.estimatedAgeGroup);
    if (person.apparentAgeYears !== undefined) parts.push(`~${person.apparentAgeYears} yrs`);

    if (parts.length > 0)
    {
        return parts.join(' · ');
    }
    else
    {
        return 'Unidentified person';
    }
}

function buildPersonTags(person: DetectedPerson): PersonTag[]
{
    const tags: PersonTag[] = [];

    if (person.isFaceCovered === true)
    {
        const detail = person.faceCoveringType ? `Face covered — ${person.faceCoveringType}` : 'Face covered';
        tags.push({ label: detail, icon: <MasksIcon />, isAlerting: true });
    }
    else if (person.isFaceCovered === false)
    {
        tags.push({ label: 'Face visible', icon: <FaceIcon />, isAlerting: false });
    }

    if (person.isSafetyVestWorn === false)
    {
        tags.push({ label: 'No safety vest', icon: <VestIcon />, isAlerting: true });
    }
    else if (person.isSafetyVestWorn === true)
    {
        tags.push({ label: 'Safety vest', icon: <VestIcon />, isAlerting: false });
    }

    const plainTags: { value?: string; icon: ReactElement }[] =
    [
        { value: person.clothingUpperColor ? `${person.clothingUpperColor} top` : undefined, icon: <ClothingIcon /> },
        { value: person.headwear, icon: <ClothingIcon /> },
        { value: person.skinToneDescription, icon: <SkinToneIcon /> },
        { value: person.facialExpression, icon: <ExpressionIcon /> },
        { value: person.postureState, icon: <PostureIcon /> },
    ];

    for (const plainTag of plainTags)
    {
        if (plainTag.value)
        {
            tags.push({ label: plainTag.value, icon: plainTag.icon, isAlerting: false });
        }
    }

    return tags;
}

function PersonCard({ person }: { person: DetectedPerson })
{
    const tags = buildPersonTags(person);

    return (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'grey.300' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Box sx={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    flexShrink: 0,
                    bgcolor: clothingColorToHex(person.clothingUpperColor),
                    border: '1px solid',
                    borderColor: 'grey.400',
                }} />
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{buildPersonHeadline(person)}</Typography>
            </Stack>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
                {tags.map((tag, tagIndex) => {
                    const tone = tag.isAlerting ? TAG_TONES.alerting : TAG_TONES.neutral;
                    return (
                        <Chip
                            key={`${tagIndex}-${tag.label}`}
                            icon={tag.icon}
                            label={tag.label}
                            size="small"
                            sx={{
                                color: tone.color,
                                bgcolor: tone.background,
                                fontWeight: tag.isAlerting ? 700 : 500,
                                '& .MuiChip-icon': { color: tone.color },
                            }}
                        />
                    );
                })}
            </Box>
        </Paper>
    );
}

export default function AiInsightPanel({ aiMetadata, eventStatus }: AiInsightPanelProps)
{
    const analysis = parseAiFrameAnalysis(aiMetadata);

    if (!analysis)
    {
        const status = (eventStatus ?? '').toUpperCase();

        if (status === 'PENDING' || status === 'PROCESSING')
        {
            return (
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">AI is analyzing this frame…</Typography>
                </Stack>
            );
        }

        if (status === 'FAILURE')
        {
            return <MuiAlert severity="warning">AI analysis failed for this event.</MuiAlert>;
        }

        return <Typography variant="body2" color="text.secondary">No AI analysis available.</Typography>;
    }

    const peopleLabel = analysis.peopleCount === 1 ? '1 person' : `${analysis.peopleCount} people`;

    return (
        <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant="subtitle2">AI Analysis</Typography>
                <Typography variant="caption" color="text.secondary">
                    {peopleLabel}{analysis.engineName ? ` · ${analysis.engineName}` : ''}
                </Typography>
            </Stack>

            {analysis.detectedPeople.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No people were detected in this frame.</Typography>
            ) : (
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1.5,
                }}>
                    {analysis.detectedPeople.map((person, index) => (
                        <PersonCard key={index} person={person} />
                    ))}
                </Box>
            )}
        </Box>
    );
}