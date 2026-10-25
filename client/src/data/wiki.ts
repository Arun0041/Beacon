export type GuideSection = { h: string; steps: string[] };
export type Guide = {
  slug: string;
  title: string;
  minutes: number;
  summary: string;
  sections: GuideSection[];
};

export const GUIDES: Guide[] = [
  {
    slug: "cpr",
    title: "CPR — Chest Compressions",
    minutes: 2,
    summary: "For an unresponsive person who is not breathing normally.",
    sections: [
      {
        h: "1. Check response",
        steps: [
          "Tap the shoulders firmly and shout 'Are you okay?'",
          "If no response, shout for help and send someone to call 112 and find an AED.",
          "Tilt the head back and lift the chin. Look for normal breathing for no more than 10 seconds.",
          "Gasping is not normal breathing — start CPR.",
        ],
      },
      {
        h: "2. Compressions",
        steps: [
          "Kneel beside the person. Place the heel of one hand on the centre of the chest, other hand on top.",
          "Push down 5–6 cm deep, hard and fast.",
          "Use the metronome below: 110 beats per minute (range 100–120).",
          "Let the chest fully rise between compressions. Do not lean on it.",
        ],
      },
      {
        h: "3. Breaths (if trained)",
        steps: [
          "After 30 compressions, give 2 rescue breaths: pinch the nose, seal your mouth over theirs, blow for 1 second until the chest rises.",
          "If untrained or unwilling, continue compressions without stopping.",
        ],
      },
      {
        h: "4. Don't stop",
        steps: [
          "Keep going until an AED arrives, professional help takes over, or the person clearly starts breathing.",
          "Swap compressors every 2 minutes if others are present — quality drops fast with fatigue.",
        ],
      },
    ],
  },
  {
    slug: "bleeding",
    title: "Severe Bleeding",
    minutes: 2,
    summary: "Stopping life-threatening blood loss from a wound or injury.",
    sections: [
      {
        h: "1. Direct pressure",
        steps: [
          "Press hard on the wound with the cleanest cloth available. Use your bare hand if nothing else exists.",
          "If blood soaks through, add more layers on top — never remove the first dressing.",
          "Keep pressing continuously. Most bleeding stops with firm, uninterrupted pressure.",
        ],
      },
      {
        h: "2. Position",
        steps: [
          "Lay the person down to prevent fainting.",
          "Raise the injured limb above heart level if it does not cause more pain or other injury.",
        ],
      },
      {
        h: "3. Tourniquet — last resort",
        steps: [
          "Only for life-threatening bleeding from an arm or leg that pressure cannot stop.",
          "Tie a wide band 5 cm above the wound, tighten until bleeding stops.",
          "Write down the time it was applied and tell responders.",
          "Never loosen it once applied.",
        ],
      },
      {
        h: "4. Shock care",
        steps: [
          "Keep the person warm with clothing or blanket.",
          "Do not give food or drink.",
          "Monitor breathing until help arrives.",
        ],
      },
    ],
  },
  {
    slug: "earthquake",
    title: "Earthquake",
    minutes: 2,
    summary: "What to do during shaking, if you are trapped, and after.",
    sections: [
      {
        h: "1. During shaking",
        steps: [
          "DROP to your hands and knees before the shaking throws you down.",
          "COVER your head and neck under a sturdy table or beside an inner wall.",
          "HOLD ON until shaking stops. Stay away from windows, mirrors and tall furniture.",
          "If in bed: stay there, cover your head with a pillow.",
        ],
      },
      {
        h: "2. If trapped",
        steps: [
          "Do not light a match — gas may be present.",
          "Tap on a pipe or wall so rescuers can hear you. A whistle carries further than your voice.",
          "Cover your mouth with cloth against dust.",
          "Shout only as a last resort — it inhales dust and drains you.",
          "Conserve phone battery: lower brightness, send one SOS, then wait.",
        ],
      },
      {
        h: "3. After",
        steps: [
          "Expect aftershocks. Move to open ground away from buildings, walls and power lines.",
          "Check others nearby — help people who cannot move on their own first.",
          "Do not enter damaged buildings. Do not use elevators.",
          "If you smell gas, leave the area and do not operate switches.",
        ],
      },
    ],
  },
  {
    slug: "flood",
    title: "Flood Safety",
    minutes: 2,
    summary: "Moving to safety in rising water and avoiding the deadliest mistakes.",
    sections: [
      {
        h: "1. Moving water kills",
        steps: [
          "Never walk through moving water. 15 cm of moving water can knock an adult down.",
          "Turn around — find higher ground or an elevated route instead of crossing.",
          "60 cm of moving water can float and sweep away a car.",
        ],
      },
      {
        h: "2. Getting high",
        steps: [
          "Move to the highest floor or ground available — never into a closed attic without an exit to the roof.",
          "Keep a marked SOS active on LifeLine so rescuers can locate you.",
          "Signal from windows with bright cloth if you cannot move.",
        ],
      },
      {
        h: "3. Electricity and water",
        steps: [
          "Stay away from power lines and electrical panels — water conducts.",
          "Switch off mains only if you can do so without stepping in water.",
        ],
      },
      {
        h: "4. Water and food",
        steps: [
          "Never drink floodwater. If you must, boil it vigorously for at least 1 minute first.",
          "Discard food touched by floodwater.",
        ],
      },
    ],
  },
];

export const EMERGENCY_NUMBER = "112";
