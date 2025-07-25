// This file exports the flowchart prompt content
// Updated: 2025-07-25 - Updated for new node shapes, labels, and voice integration
// You can edit this file directly

export const promptContent = `# AI Flowchart Generation Prompt

## System Prompt
You are a helpful assistant that generates flowchart data structures in JSON format.

## User Instructions
Generate a flowchart based on the provided requirements and JSON format template.

## JSON Format Template 
See file: C:\Users\chris\empart\assets\flowchart\templates\template1.json

## Node Types and Shapes
- **self**: Circle (representing the core Self)
- **manager**: Hexagon (protective parts that manage situations)
- **firefighter**: Triangle (reactive parts that respond to crises)
- **exile**: Square (vulnerable parts carrying pain/trauma)
- **need**: Pentagon (basic human needs)

## Relationship Types
Make sure that the relationship types that are generated are the same as the ones in the JSON format template, based on the "from" and "to" nodes:
"edges": [
      {
        "from": "unmetNeed",
        "to": "exile",
        "type": "💚",
        "label": ""
      },
      {
        "from": "unmetNeed",
        "to": "firefighter",
        "type": "💔",
        "label": ""
      },
      {
        "from": "firefighter",
        "to": "node-1753336401930",
        "type": "❌",
        "label": ""
      },
      {
        "from": "node-1753336401930",
        "to": "node-1753425439058",
        "type": "🚨",
        "label": ""

## Final Instructions
Create a well-structured flowchart layout with properly positioned nodes and clear connections. Follow these guidelines:

1. **Node Structure**: Use separate \`id\` and \`label\` fields - \`id\` should be unique identifiers, \`label\` is the display name
2. **Node Types**: Use the 5 node types (self, manager, firefighter, exile, need) which will render as different shapes
3. **Spacing**: Ensure nodes are spaced at least 150 pixels apart to prevent visual overlap
4. **Coordinate System**: Use a coordinate space of approximately 800x800 pixels for adequate spacing
5. **Equal Areas**: All node shapes are sized to have equal visual areas regardless of shape type
6. **Edge Labels**: Include optional \`label\` field on edges for additional relationship context
7. **Metadata**: Include version, timestamp, and descriptive notes in the metadata section
8. **Node IDs** Create a 1-2 word ID for each node, based on the description of the node.
9. **Node Descriptions** Create a description for each node of 1-4 sentences in length based on the user's conversation with the AI.
10. **Node Conversations** Create a transcript of the conversation(s) between the user and the AI for each node.

The flowchart will automatically render with:
- Dynamic viewBox that adjusts to content
- Interactive node dragging and editing
- Voice-based creation support using exported templates
- Real-time updates to Supabase database`;


export default promptContent;