import Constants from "expo-constants";
import { HStack, Image, ProgressView, Text, VStack } from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  frame,
  padding,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { after, createLiveActivity, type LiveActivity } from "expo-widgets";
import type { ReminderLiveActivityPayload } from "./reminderLiveActivity.types";

const ACCENT = "#818CF8";
const DANGER = "#F87171";

const ReminderCountdownActivity = createLiveActivity<ReminderLiveActivityPayload>(
  "ReminderCountdownActivity",
  (props) => {
    "widget";

    const warningAt = new Date(props.warningAtISO);
    const startsAt = new Date(props.startsAtISO);
    const timerRange = { lower: warningAt, upper: startsAt };

    return {
      banner: (
        <VStack modifiers={[padding({ all: 14 })]}>
          <HStack>
            <Image systemName="timer.circle.fill" color={ACCENT} />
            <Text modifiers={[font({ weight: "semibold", size: 15 }), foregroundStyle(ACCENT)]}>
              Countdown active
            </Text>
          </HStack>
          <Text modifiers={[font({ weight: "bold", size: 18 }), foregroundStyle("#FFFFFF")]}>
            {props.title}
          </Text>
          <Text
            timerInterval={timerRange}
            countsDown
            modifiers={[font({ design: "monospaced", weight: "heavy", size: 28 }), foregroundStyle(DANGER)]}
          />
          {props.description ? (
            <Text modifiers={[font({ size: 13 }), foregroundStyle("#D1D5DB")]}>
              {props.description}
            </Text>
          ) : null}
          <ProgressView
            timerInterval={timerRange}
            countsDown
            modifiers={[tint(ACCENT), frame({ maxWidth: 260 })]}
          />
        </VStack>
      ),
      bannerSmall: (
        <HStack modifiers={[padding({ all: 12 })]}>
          <Image systemName="timer.circle.fill" color={ACCENT} />
          <Text
            timerInterval={timerRange}
            countsDown
            modifiers={[font({ design: "monospaced", weight: "heavy", size: 17 }), foregroundStyle(DANGER)]}
          />
        </HStack>
      ),
      compactLeading: <Image systemName="timer.circle.fill" color={ACCENT} />,
      compactTrailing: (
        <Text
          timerInterval={timerRange}
          countsDown
          modifiers={[font({ design: "monospaced", weight: "bold", size: 13 }), foregroundStyle(DANGER)]}
        />
      ),
      minimal: <Image systemName="timer.circle.fill" color={ACCENT} />,
      expandedCenter: (
        <VStack modifiers={[padding({ all: 10 })]}>
          <Text modifiers={[font({ weight: "bold", size: 14 }), foregroundStyle("#FFFFFF")]}>
            {props.title}
          </Text>
          <ProgressView timerInterval={timerRange} countsDown modifiers={[tint(ACCENT)]} />
        </VStack>
      ),
      expandedLeading: (
        <VStack modifiers={[padding({ all: 10 })]}>
          <Image systemName="timer.circle.fill" color={ACCENT} />
          <Text modifiers={[font({ size: 11 }), foregroundStyle("#D1D5DB")]}>Reminder</Text>
        </VStack>
      ),
      expandedTrailing: (
        <VStack modifiers={[padding({ all: 10 })]}>
          <Text
            timerInterval={timerRange}
            countsDown
            modifiers={[font({ design: "monospaced", weight: "heavy", size: 22 }), foregroundStyle(DANGER)]}
          />
          <Text modifiers={[font({ size: 11 }), foregroundStyle("#D1D5DB")]}>to start</Text>
        </VStack>
      ),
      expandedBottom: (
        <VStack modifiers={[padding({ horizontal: 12, bottom: 12 })]}>
          <Text modifiers={[font({ weight: "bold", size: 15 }), foregroundStyle("#FFFFFF")]}>
            {props.title}
          </Text>
          <ProgressView timerInterval={timerRange} countsDown modifiers={[tint(ACCENT)]} />
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
): Promise<void> {
  try {
    if (Constants.appOwnership === "expo") {
      // eslint-disable-next-line no-console
      console.warn("[Live Activity] Dynamic Island requires a rebuilt native dev/production app, not Expo Go.");
      return;
    }

    if (!payload) {
      await endCurrentActivity("immediate");
      return;
    }

    const startsAt = new Date(payload.startsAtISO);
    const now = Date.now();
    if (startsAt.getTime() <= now) {
      await endCurrentActivity("immediate");
      return;
    }

    const reminderKey = `${payload.reminderId}@${payload.startsAtISO}`;
    if (currentActivity && currentReminderKey === reminderKey) {
      await currentActivity.update(payload);
    } else {
      await endCurrentActivity("immediate");
      const activeInstances = ReminderCountdownActivity.getInstances();
      currentActivity = activeInstances[0] ?? ReminderCountdownActivity.start(
        payload,
        `officereminder://team/${payload.reminderId}`,
      );
      await currentActivity.update(payload);
      currentReminderKey = reminderKey;
      // eslint-disable-next-line no-console
      console.log("[Live Activity] Reminder countdown is active for Dynamic Island.");
    }

    scheduleActivityEnd(startsAt, payload);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[Live Activity] Unable to sync reminder countdown:", error);
  }
}

async function endCurrentActivity(policy: "default" | "immediate") {
  if (endTimer) {
    clearTimeout(endTimer);
    endTimer = null;
  }
  if (!currentActivity) return;
  await currentActivity.end(policy);
  currentActivity = null;
  currentReminderKey = null;
}

function scheduleActivityEnd(startsAt: Date, payload: ReminderLiveActivityPayload) {
  if (endTimer) clearTimeout(endTimer);
  const dismissAt = new Date(startsAt.getTime() + 5 * 60_000);
  const delay = Math.max(0, Math.min(dismissAt.getTime() - Date.now(), 2_147_483_647));
  endTimer = setTimeout(async () => {
    if (!currentActivity) return;
    await currentActivity.end(after(dismissAt), {
      ...payload,
      description: payload.description || "Reminder started.",
    }, new Date());
    currentActivity = null;
    currentReminderKey = null;
  }, delay);
}
