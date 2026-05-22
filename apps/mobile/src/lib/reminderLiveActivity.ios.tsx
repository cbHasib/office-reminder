import { HStack, Image, ProgressView, Text, VStack, Spacer, ZStack } from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  frame,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { after, createLiveActivity, type LiveActivity } from "expo-widgets";
import type { ReminderLiveActivityPayload } from "./reminderLiveActivity.types";

const ReminderCountdownActivity = createLiveActivity<ReminderLiveActivityPayload>(
  "ReminderCountdownActivity",
  (props) => {
    "widget";

    const ACCENT = "#818CF8";
    const ACTIVE = "#34D399";
    const GREY = "#9CA3AF";
    const WHITE = "#FFFFFF";

    const warningAt = new Date(props.warningAtISO);
    const startsAt = new Date(props.startsAtISO);
    const timerRange = { lower: warningAt, upper: startsAt };

    const cleanTitle = props.title.replace(/[^a-zA-Z0-9\s]/g, "");
    const words = cleanTitle.split(/\s+/).filter(Boolean);
    let eventCode = "MEET";
    if (words.length >= 2) {
      eventCode = (words[0][0] + words[1][0] + (words[2]?.[0] || "")).toUpperCase().slice(0, 4);
    } else if (words.length === 1) {
      eventCode = words[0].slice(0, 4).toUpperCase();
    }

    return {
      banner: (
        <VStack modifiers={[padding({ all: 16 })]}>
          {/* Title and Description */}
          <VStack alignment="leading" modifiers={[padding({ bottom: 4 })]}>
            <Text modifiers={[font({ weight: "black", size: 18 }), foregroundStyle(WHITE)]}>
              {props.title}
            </Text>
            {props.description ? (
              <Text modifiers={[font({ size: 12 }), foregroundStyle(GREY), padding({ top: 2 })]}>
                {props.description}
              </Text>
            ) : null}
          </VStack>

          {/* Progress Bar Row */}
          <HStack alignment="top" modifiers={[padding({ vertical: 6 })]}>
            <Image systemName="bell.fill" color={ACCENT} modifiers={[font({ size: 12 }), padding({ trailing: 8 })]} />
            <ZStack alignment="bottomTrailing">
              <ProgressView
                timerInterval={timerRange}
                countsDown
                modifiers={[tint(ACCENT)]}
              />
              <Text modifiers={[font({ weight: "semibold", size: 11 }), foregroundStyle(ACTIVE)]}>
                {props.startsAtFormatted || "Soon"}
              </Text>
            </ZStack>
            <Image systemName="bell.badge.fill" color={ACTIVE} modifiers={[font({ size: 12 }), padding({ leading: 8 })]} />
          </HStack>
        </VStack>
      ),
      bannerSmall: (
        <HStack modifiers={[padding({ all: 12 })]}>
          <Image systemName="bell.fill" color={ACCENT} />
          <Text
            timerInterval={timerRange}
            countsDown
            modifiers={[font({ design: "monospaced", weight: "bold", size: 16 }), foregroundStyle(ACCENT)]}
          />
        </HStack>
      ),
      compactLeading: (
        <HStack modifiers={[padding({ leading: 6 })]}>
          <Image systemName="bell.fill" color={ACCENT} modifiers={[font({ size: 11 })]} />
        </HStack>
      ),
      compactTrailing: (
        <HStack modifiers={[padding({ trailing: 6 })]}>
          <Text
            timerInterval={timerRange}
            countsDown
            modifiers={[font({ design: "monospaced", weight: "bold", size: 11 }), foregroundStyle(ACCENT)]}
          />
        </HStack>
      ),
      minimal: <Image systemName="bell.fill" color={ACCENT} modifiers={[font({ size: 11 })]} />,
      expandedLeading: (
        <VStack alignment="leading" modifiers={[padding({ leading: 10, top: 12 })]}>
          <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(WHITE)]}>
            {props.title}
          </Text>
          {props.description ? (
            <Text modifiers={[font({ size: 10 }), foregroundStyle(GREY), padding({ top: 1 })]}>
              {props.description}
            </Text>
          ) : null}
        </VStack>
      ),
      expandedTrailing: (
        <VStack alignment="trailing" modifiers={[padding({ trailing: 10, top: 12 })]}>
          <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle(WHITE)]}>
            {props.startsAtFormatted || "Soon"}
          </Text>
          <Text modifiers={[font({ weight: "bold", size: 10 }), foregroundStyle(props.startsAtFormatted === "Now" ? ACTIVE : ACCENT), padding({ top: 2 })]}>
            {props.startsAtFormatted === "Now" ? "LIVE" : "ON TIME"}
          </Text>
        </VStack>
      ),
      expandedCenter: null,
      expandedBottom: (
        <VStack modifiers={[padding({ horizontal: 10, bottom: 8 })]}>
          <HStack alignment="top" modifiers={[padding({ vertical: 4 })]}>
            <Image systemName="bell.fill" color={ACCENT} modifiers={[font({ size: 12 }), padding({ trailing: 8 })]} />
            <ZStack alignment="bottomTrailing">
              <ProgressView
                timerInterval={timerRange}
                countsDown
                modifiers={[tint(ACCENT)]}
              />
              <Text modifiers={[font({ weight: "semibold", size: 11 }), foregroundStyle(ACTIVE)]}>
                {props.startsAtFormatted || "Soon"}
              </Text>
            </ZStack>
            <Image systemName="bell.badge.fill" color={ACTIVE} modifiers={[font({ size: 12 }), padding({ leading: 8 })]} />
          </HStack>
        </VStack>
      ),
    };
  },
);

let currentActivity: LiveActivity<ReminderLiveActivityPayload> | null = null;
let currentReminderKey: string | null = null;
let endTimer: ReturnType<typeof setTimeout> | null = null;

export async function syncReminderLiveActivity(
  payload: ReminderLiveActivityPayload | null,
  throwOnError = false,
): Promise<void> {
  try {
    if (!payload) {
      await endCurrentActivity("immediate");
      return;
    }

    const startsAt = new Date(payload.startsAtISO);
    const now = Date.now();
    
    // If the event started more than 60 seconds ago, dismiss immediately
    if (startsAt.getTime() + 60_000 <= now) {
      await endCurrentActivity("immediate");
      return;
    }

    const reminderKey = `${payload.reminderId}@${payload.startsAtISO}`;
    const isHappeningNow = startsAt.getTime() <= now;

    // If it's already happening and currentActivity is null but key matches,
    // we already finished the "Happening now!" transition. Avoid recreation/re-updating.
    if (isHappeningNow && currentReminderKey === reminderKey && !currentActivity) {
      return;
    }

    const activePayload: ReminderLiveActivityPayload = isHappeningNow ? {
      ...payload,
      description: "Happening now!",
      startsAtFormatted: "Now",
    } : payload;

    if (isHappeningNow) {
      // Transition immediately to Happening Now and schedule graceful Lock Screen exit in 60s
      if (currentActivity && currentReminderKey === reminderKey) {
        await currentActivity.update(activePayload);
        const dismissAt = new Date(startsAt.getTime() + 60_000);
        await currentActivity.end(after(dismissAt), activePayload, new Date());
        currentActivity = null;
      } else {
        await endCurrentActivity("immediate");
        const activeInstances = await ReminderCountdownActivity.getInstances();
        const startedActivity = activeInstances[0] ?? (await ReminderCountdownActivity.start(
          activePayload,
          `officereminder://team/${payload.reminderId}`,
        ));
        currentActivity = startedActivity;
        await currentActivity.update(activePayload);
        const dismissAt = new Date(startsAt.getTime() + 60_000);
        await currentActivity.end(after(dismissAt), activePayload, new Date());
        currentActivity = null;
      }
      currentReminderKey = reminderKey;
      if (endTimer) {
        clearTimeout(endTimer);
        endTimer = null;
      }
      return;
    }

    // Active countdown phase
    if (currentActivity && currentReminderKey === reminderKey) {
      await currentActivity.update(activePayload);
    } else {
      await endCurrentActivity("immediate");
      const activeInstances = await ReminderCountdownActivity.getInstances();
      const startedActivity = activeInstances[0] ?? (await ReminderCountdownActivity.start(
        activePayload,
        `officereminder://team/${payload.reminderId}`,
      ));
      currentActivity = startedActivity;
      await currentActivity.update(activePayload);
      currentReminderKey = reminderKey;
      // eslint-disable-next-line no-console
      console.log("[Live Activity] Reminder countdown is active for Dynamic Island.");
    }

    scheduleActivityEnd(startsAt, payload);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[Live Activity] Unable to sync reminder countdown:", error);
    if (throwOnError) {
      throw error;
    }
  }
}

async function endCurrentActivity(policy: "default" | "immediate") {
  if (endTimer) {
    clearTimeout(endTimer);
    endTimer = null;
  }
  if (currentActivity) {
    try {
      await currentActivity.end(policy);
    } catch (e) {
      // Ignore if already ended
    }
    currentActivity = null;
  }
  try {
    const activeInstances = await ReminderCountdownActivity.getInstances();
    for (const activity of activeInstances) {
      try {
        await activity.end(policy);
      } catch (e) {
        // Ignore errors on individual instances
      }
    }
  } catch (e) {
    // Ignore if getInstances fails
  }
  currentReminderKey = null;
}

function scheduleActivityEnd(startsAt: Date, payload: ReminderLiveActivityPayload) {
  if (endTimer) clearTimeout(endTimer);
  
  const now = Date.now();
  const eventDelay = Math.max(0, startsAt.getTime() - now);
  
  endTimer = setTimeout(async () => {
    if (!currentActivity) return;
    try {
      const finalPayload = {
        ...payload,
        description: "Happening now!",
        startsAtFormatted: "Now",
      };
      await currentActivity.update(finalPayload);
      
      const dismissAt = new Date(startsAt.getTime() + 60_000);
      await currentActivity.end(after(dismissAt), finalPayload, new Date());
    } catch (e) {
      // Ignore
    }
    currentActivity = null;
  }, eventDelay);
}
