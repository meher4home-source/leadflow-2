// lib/industries.js — qualifying questions per industry, used by the AI when
// deciding what to ask a lead next.

module.exports = {
  wholesaler: {
    label: 'Real Estate Wholesaler',
    questions: [
      "What's the property address or area?",
      'What condition is the property in?',
      'What price are you hoping to get for it?',
      'How soon are you looking to sell?',
    ],
  },
  roofing: {
    label: 'Roofing Contractor',
    questions: [
      'Is this for a repair or a full roof replacement?',
      'Roughly how old is the current roof?',
      'Are you working with an insurance claim?',
      'How soon would you like an estimate?',
    ],
  },
  hvac: {
    label: 'HVAC / Solar Contractor',
    questions: [
      'Is this a repair, replacement, or new installation?',
      'Is this urgent (no heat/cooling right now)?',
      "What's your rough budget range?",
      'How soon are you looking to move forward?',
    ],
  },
  injury_law: {
    label: 'Personal Injury Law Firm',
    questions: [
      'What type of accident happened?',
      'Have you received medical treatment so far?',
      'Has an insurance company contacted you yet?',
      'When did the accident happen?',
    ],
  },
  dental: {
    label: 'Dental Implant Clinic',
    questions: [
      'How many teeth are you looking to replace?',
      'Do you have dental insurance?',
      "What's your ideal timeline?",
    ],
  },
  mortgage: {
    label: 'Mortgage Broker',
    questions: [
      'Are you looking to buy or refinance?',
      "What's the approximate home price or loan amount?",
      'How soon do you need to close?',
    ],
  },
  insurance: {
    label: 'Insurance Broker',
    questions: [
      'What type of coverage are you looking for?',
      'Do you currently have a policy elsewhere?',
      'How soon are you looking to switch?',
    ],
  },
  moving: {
    label: 'Moving Company',
    questions: [
      'Where are you moving from and to?',
      'Roughly how many rooms of furniture?',
      "What's your target moving date?",
    ],
  },
  renovation: {
    label: 'Home Renovation Contractor',
    questions: [
      'What part of the home are you renovating?',
      'Do you have a budget range in mind?',
      "What's your ideal start date?",
    ],
  },
  wedding: {
    label: 'Luxury Wedding Planner',
    questions: [
      "What's your wedding date?",
      'Roughly how many guests?',
      "What's your overall budget range?",
    ],
  },
  auto: {
    label: 'Luxury Auto Dealer',
    questions: ['Which model are you interested in?', "What's your budget range?", 'Purchase or lease?'],
  },
  immigration: {
    label: 'Immigration Consultant',
    questions: [
      'What type of visa or status are you working on?',
      'Is there a deadline involved?',
      'Have you worked with an attorney on this before?',
    ],
  },
  other: {
    label: 'Other High-Ticket Business',
    questions: [
      'What service are you looking for?',
      "What's your rough budget range?",
      'How soon are you looking to move forward?',
    ],
  },
};
