import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct ReminderCountdownActivity: Widget {
  let name: String = "ReminderCountdownActivity"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      WidgetsEntryView(entry: entry)
    }
    .configurationDisplayName("Reminder Countdown")
    .description("Shows a live countdown for the next office reminder.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
  }
}