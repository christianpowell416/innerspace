/**
 * Test data utilities for parts and needs bubble charts
 */

import {
  PartBubbleData,
  NeedBubbleData,
  getPartColor,
  getNeedColor,
  getPartCategory,
  getNeedCategory
} from '../types/partsNeedsChart';

export const generateTestPartsData = (count: number = 6): PartBubbleData[] => {
  const parts = [
    'Critical', 'Perfectionist', 'Controller', 'Caretaker', 'Achiever',
    'Pleaser', 'Rebellious', 'Addictive', 'Protective', 'Inner Child',
    'Wounded', 'Abandoned', 'Creative', 'Playful', 'Vulnerable'
  ];

  return parts.slice(0, count).map((part, index) => {
    const frequency = Math.floor(Math.random() * 10) + 1; // 1-10 (larger range for full space usage)
    const intensity = Math.random() * 10; // 0-10
    const radius = Math.max(18, Math.min(45, frequency * 3.5 + 10)); // Increased minimum radius to prevent text cutoff

    return {
      id: `test-part-${index}`,
      name: part,
      frequency,
      intensity,
      color: getPartColor(part),
      radius,
      category: getPartCategory(part),
      lastSeen: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000), // Last 14 days
      conversationIds: Array.from(
        { length: Math.floor(Math.random() * 3) + 1 },
        (_, i) => `conv-part-${index}-${i}`
      ),
    };
  });
};

export const generateTestNeedsData = (count: number = 6): NeedBubbleData[] => {
  const needs = [
    'Security', 'Understanding', 'Connection', 'Love', 'Freedom',
    'Autonomy', 'Appreciation', 'Recognition', 'Purpose', 'Growth',
    'Learning', 'Creativity', 'Community', 'Trust', 'Acceptance'
  ];

  return needs.slice(0, count).map((need, index) => {
    const frequency = Math.floor(Math.random() * 10) + 1; // 1-10 (larger range for full space usage)
    const intensity = Math.random() * 10; // 0-10
    const radius = Math.max(18, Math.min(45, frequency * 3.5 + 10)); // Increased minimum radius to prevent text cutoff

    return {
      id: `test-need-${index}`,
      name: need,
      frequency,
      intensity,
      color: getNeedColor(need),
      radius,
      category: getNeedCategory(need),
      lastSeen: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000), // Last 14 days
      conversationIds: Array.from(
        { length: Math.floor(Math.random() * 3) + 1 },
        (_, i) => `conv-need-${index}-${i}`
      ),
    };
  });
};

// Utility functions for stats generation (if needed later)
export const createPartsStats = (parts: PartBubbleData[]) => {
  if (parts.length === 0) {
    return {
      totalParts: 0,
      totalMentions: 0,
      mostActive: null,
      averageIntensity: 0,
      recentParts: []
    };
  }

  const totalMentions = parts.reduce((sum, p) => sum + p.frequency, 0);
  const averageIntensity = parts.reduce((sum, p) => sum + p.intensity, 0) / parts.length;
  const mostActive = parts.reduce((max, p) =>
    p.frequency > max.frequency ? p : max
  );

  return {
    totalParts: parts.length,
    totalMentions,
    mostActive: {
      name: mostActive.name,
      count: mostActive.frequency,
      averageIntensity: mostActive.intensity,
      latestDate: mostActive.lastSeen,
      conversationIds: mostActive.conversationIds
    },
    averageIntensity: Math.round(averageIntensity * 10) / 10,
    recentParts: parts
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, 3)
      .map(p => ({
        name: p.name,
        count: p.frequency,
        averageIntensity: p.intensity,
        latestDate: p.lastSeen,
        conversationIds: p.conversationIds
      }))
  };
};

export const createNeedsStats = (needs: NeedBubbleData[]) => {
  if (needs.length === 0) {
    return {
      totalNeeds: 0,
      totalMentions: 0,
      mostImportant: null,
      averageIntensity: 0,
      recentNeeds: []
    };
  }

  const totalMentions = needs.reduce((sum, n) => sum + n.frequency, 0);
  const averageIntensity = needs.reduce((sum, n) => sum + n.intensity, 0) / needs.length;
  const mostImportant = needs.reduce((max, n) =>
    n.frequency > max.frequency ? n : max
  );

  return {
    totalNeeds: needs.length,
    totalMentions,
    mostImportant: {
      name: mostImportant.name,
      count: mostImportant.frequency,
      averageIntensity: mostImportant.intensity,
      latestDate: mostImportant.lastSeen,
      conversationIds: mostImportant.conversationIds
    },
    averageIntensity: Math.round(averageIntensity * 10) / 10,
    recentNeeds: needs
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, 3)
      .map(n => ({
        name: n.name,
        count: n.frequency,
        averageIntensity: n.intensity,
        latestDate: n.lastSeen,
        conversationIds: n.conversationIds
      }))
  };
};