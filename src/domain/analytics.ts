export const ANALYTICS_TYPES = [
  "recommendation_shown",
  "profile_viewed",
  "intro_requested",
  "connection_accepted",
  "share_link",
  "share_qr",
  "share_nfc",
] as const;

export type AnalyticsType = (typeof ANALYTICS_TYPES)[number];

export type AnalyticsRecord = {
  id: string;
  eventId: string;
  type: AnalyticsType;
  at: string;
  topic: string | null;
};

export type AggregateReport = {
  visible: number;
  recommendations: number;
  profileViews: number;
  requests: number;
  accepted: number;
  conversion: number | null;
  shares: { link: number; qr: number; nfc: number };
  topics: { topic: string; count: number }[];
  suppressedTopics: number;
  timeline: { hour: string; count: number }[];
};

const MIN_GROUP = 5;

export function aggregateActivity(input: {
  events: readonly AnalyticsRecord[];
  visible: number;
  minGroup?: number;
}): AggregateReport {
  const minGroup = input.minGroup ?? MIN_GROUP;
  const count = (type: AnalyticsType) => input.events.filter((event) => event.type === type).length;
  const recommendations = count("recommendation_shown");
  const accepted = count("connection_accepted");
  const topics = new Map<string, number>();
  for (const event of input.events) {
    if (!event.topic) continue;
    topics.set(event.topic, (topics.get(event.topic) ?? 0) + 1);
  }
  const listed = [...topics.entries()].filter(([, value]) => value >= minGroup);
  const hours = new Map<string, number>();
  for (const event of input.events) {
    const hour = event.at.slice(0, 13);
    hours.set(hour, (hours.get(hour) ?? 0) + 1);
  }
  return {
    visible: input.visible,
    recommendations,
    profileViews: count("profile_viewed"),
    requests: count("intro_requested"),
    accepted,
    conversion: recommendations > 0 ? accepted / recommendations : null,
    shares: {
      link: count("share_link"),
      qr: count("share_qr"),
      nfc: count("share_nfc"),
    },
    topics: listed
      .map(([topic, value]) => ({ topic, count: value }))
      .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic)),
    suppressedTopics: topics.size - listed.length,
    timeline: [...hours.entries()]
      .map(([hour, value]) => ({ hour, count: value }))
      .sort((a, b) => a.hour.localeCompare(b.hour)),
  };
}
