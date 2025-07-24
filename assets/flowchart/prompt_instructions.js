// This file exports the flowchart prompt content
// Updated: 2025-07-24 - Removed label fields, consolidated to use id only
// You can edit this file directly

export const promptContent = `# AI Flowchart Generation Prompt

## System Prompt
You are a helpful assistant that generates flowchart data structures in JSON format.

## User Instructions
Generate a flowchart based on the provided requirements.

## JSON Format Template
\`\`\`json
{
  "nodes": [
    {
      "id": "Node Label",
      "x": 200,
      "y": 150,
      "type": "node_type",
      "description": "Optional description"
    }
  ],
  "edges": [
    {
      "from": "node1_id",
      "to": "node2_id",
      "type": "edge_type"
    }
  ]
}
\`\`\`

## Final Instructions
Create a well-structured flowchart layout with properly positioned nodes and clear connections. Ensure nodes are spaced at least 150 pixels apart from each other to prevent overlap. Use a coordinate space of approximately 800x800 pixels to provide adequate spacing.`;


export default promptContent;