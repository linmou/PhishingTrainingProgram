const systemPrompt = `You are a professional teacher in an online teaching platform that helps students to understand the some knowledge.

## Your Role: Trusted Adult Guide
You position yourself as an experienced guide offering protective support. Use mature, supportive language like "This shows several concerning patterns" while drawing on established expertise: "In my experience helping people with scams..." Provide direct guidance through statements like "Let me show you what to look for" and teach from a position of knowledge: "One important thing to know about URLs is..." Express protective care with phrases like "I want to make sure you stay safe online," creating a supportive mentoring dynamic.

## Communication Style:
Use formal, clear language without slang.
Use direct, clean speech patterns.
Make definitive statements with confidence.

## Detection Areas to Focus On:
- Full name and age: Complete identity information visible
- School or work location: Making yourself findable in real life
- Family information: Details about parents, siblings, or relatives
- Financial information: Bank details, income, or spending habits
- Daily routines: Patterns that make you predictable and targetable

## Verification Steps to Teach:
- Review privacy settings: Regularly check who can see your posts
- Think before posting: Ask "Would I be comfortable if anyone saw this?"
- Limit personal details: Keep sensitive information off public profiles
- Use privacy-first platforms: Choose apps that prioritize user privacy
- Educate friends: Help friends understand privacy risks too
- Regular audits: Periodically review and delete old posts with personal info

Remember: Your goal is to help teens develop critical thinking skills for online safety through guided discovery and supportive learning.`;

// Manual extraction using regex (basic approach)
function extractBasicSections(prompt) {
  const detectionAreasMatch = prompt.match(/## Detection Areas to Focus On:\s*((?:(?!## ).|\n)*)/);
  const verificationStepsMatch = prompt.match(/## Verification Steps to Teach:\s*((?:(?!## ).|\n)*)/);
  
  const extractBulletPoints = (text) => {
    if (!text) return [];
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('- ') || line.startsWith('* '))
      .map(line => line.substring(2).trim())
      .filter(line => line.length > 0);
  };
  
  return {
    detection_areas: extractBulletPoints(detectionAreasMatch?.[1]),
    verification_steps: extractBulletPoints(verificationStepsMatch?.[1])
  };
}

console.log('=== Testing Basic Extraction ===');
const result = extractBasicSections(systemPrompt);

console.log('\n📋 Extracted Detection Areas:');
result.detection_areas.forEach((area, index) => {
  console.log(`  ${index + 1}. ${area}`);
});

console.log('\n🔧 Extracted Verification Steps:');
result.verification_steps.forEach((step, index) => {
  console.log(`  ${index + 1}. ${step}`);
});

console.log('\n=== Expected vs Extracted Comparison ===');
const expected_detection = [
  'Full name and age: Complete identity information visible',
  'School or work location: Making yourself findable in real life', 
  'Family information: Details about parents, siblings, or relatives',
  'Financial information: Bank details, income, or spending habits',
  'Daily routines: Patterns that make you predictable and targetable'
];

const expected_verification = [
  'Review privacy settings: Regularly check who can see your posts',
  'Think before posting: Ask "Would I be comfortable if anyone saw this?"',
  'Limit personal details: Keep sensitive information off public profiles',
  'Use privacy-first platforms: Choose apps that prioritize user privacy',
  'Educate friends: Help friends understand privacy risks too',
  'Regular audits: Periodically review and delete old posts with personal info'
];

console.log(`\n✅ Detection Areas Match: ${result.detection_areas.length}/${expected_detection.length}`);
result.detection_areas.forEach((extracted, i) => {
  const expected = expected_detection[i];
  const matches = extracted === expected;
  console.log(`  ${matches ? '✓' : '✗'} "${extracted}"`);
  if (!matches && expected) {
    console.log(`     Expected: "${expected}"`);
  }
});

console.log(`\n✅ Verification Steps Match: ${result.verification_steps.length}/${expected_verification.length}`);
result.verification_steps.forEach((extracted, i) => {
  const expected = expected_verification[i];
  const matches = extracted === expected;
  console.log(`  ${matches ? '✓' : '✗'} "${extracted}"`);
  if (!matches && expected) {
    console.log(`     Expected: "${expected}"`);
  }
});

console.log('\n=== Summary ===');
console.log(`Detection Areas: ${result.detection_areas.length} extracted, ${expected_detection.length} expected`);
console.log(`Verification Steps: ${result.verification_steps.length} extracted, ${expected_verification.length} expected`);

const detectionMatch = result.detection_areas.length === expected_detection.length && 
                      result.detection_areas.every((item, i) => item === expected_detection[i]);
const verificationMatch = result.verification_steps.length === expected_verification.length && 
                         result.verification_steps.every((item, i) => item === expected_verification[i]);

console.log(`Overall Success: ${detectionMatch && verificationMatch ? '✅ PASS' : '❌ NEEDS REVIEW'}`);