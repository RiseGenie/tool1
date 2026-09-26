const CCP_TONES = [
  {
    id: 'supportive',
    label: 'Supportive',
    instruction: "Warm and genuinely supportive. Validate the author's point and add a brief personal reaction to it.",
  },
  {
    id: 'insightful',
    label: 'Insightful',
    instruction: 'Thoughtful, like a peer practitioner. Add one concrete idea, example, or angle that builds on the post without just repeating it.',
  },
  {
    id: 'curious',
    label: 'Curious',
    instruction: 'Curious and inquisitive. Ask one genuine, specific follow-up question about something in the post.',
  },
  {
    id: 'contrarian',
    label: 'Contrarian',
    instruction: 'Respectfully challenge one assumption or claim in the post with a brief, civil counterpoint. Stay constructive, not combative.',
  },
  {
    id: 'congratulatory',
    label: 'Congratulatory',
    instruction: 'Warm and celebratory. Congratulate the author specifically on what they shared, referencing a real detail from the post.',
  },
  {
    id: 'witty',
    label: 'Witty',
    instruction: 'Light, witty, a little playful — while staying professional and clearly relevant to the post.',
  },
  {
    id: 'custom',
    label: 'Custom…',
    instruction: null,
  },
];

function ccpToneById(id) {
  return CCP_TONES.find((t) => t.id === id) || CCP_TONES[0];
}
