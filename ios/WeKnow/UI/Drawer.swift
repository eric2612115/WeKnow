// The side drawer, as chat apps have it: it slides in from the left over a dimmed page. New conversation at the top,
// the places (My checks, What WeKnow remembers, Knowledge packs, Settings), then recent checks to open again.
// A tap on the dimmed page, a swipe to the left, or Close shuts it.

import SwiftUI

struct Drawer: View {
  @Binding var open: Bool
  let newConversation: () -> Void
  let go: (MenuPage) -> Void
  let openCheck: (CheckRecord) -> Void
  private var home = Household.shared
  @GestureState private var drag: CGFloat = 0

  init(open: Binding<Bool>, newConversation: @escaping () -> Void, go: @escaping (MenuPage) -> Void, openCheck: @escaping (CheckRecord) -> Void) {
    _open = open
    self.newConversation = newConversation
    self.go = go
    self.openCheck = openCheck
  }

  var body: some View {
    GeometryReader { geo in
      let width = min(geo.size.width * 0.84, 340)
      ZStack(alignment: .leading) {
        if open {
          Color.black.opacity(0.32).ignoresSafeArea()
            .onTapGesture { close() }
            .accessibilityLabel("Close the menu")
            .accessibilityAddTraits(.isButton)
            .transition(.opacity)
          panel
            .frame(width: width)
            .frame(maxHeight: .infinity)
            .background(Color.bg.ignoresSafeArea())
            .offset(x: min(0, drag))
            .gesture(DragGesture().updating($drag) { v, s, _ in s = v.translation.width }.onEnded { v in
              if v.translation.width < -width * 0.3 { close() }
            })
            .transition(.move(edge: .leading))
            .accessibilityAddTraits(.isModal)
        }
      }
      .animation(.weknow(0.28), value: open)
    }
  }

  private func close() { open = false }

  private var recent: [CheckRecord] { Array(home.checks.sorted { $0.date > $1.date }.prefix(12)) }

  private var panel: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack {
        Text("WeKnow").font(.system(size: 20, weight: .semibold)).foregroundStyle(Color.ink)
        Spacer()
        Button { close() } label: {
          Image(systemName: "xmark").font(.system(size: 17, weight: .medium)).foregroundStyle(Color.ink).frame(width: 44, height: 44)
        }
        .accessibilityLabel("Close the menu")
      }
      .padding(.leading, 20).padding(.trailing, 8).frame(height: 56)

      ScrollView {
        VStack(alignment: .leading, spacing: 2) {
          row("square.and.pencil", "New conversation") { close(); newConversation() }
          Divider().padding(.vertical, 8).padding(.horizontal, 20)
          row("folder", "My checks") { close(); go(.checks) }
          row("book.closed", "What WeKnow remembers") { close(); go(.remembers) }
          row("books.vertical", "Knowledge packs") { close(); go(.priceBook) }
          row("gearshape", "Settings") { close(); go(.settings) }
          if !recent.isEmpty {
            Text("Recent").font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.ink2)
              .padding(.horizontal, 20).padding(.top, 22).padding(.bottom, 6)
            ForEach(recent) { r in
              Button { close(); openCheck(r) } label: {
                VStack(alignment: .leading, spacing: 2) {
                  Text(r.title).font(.system(size: 16)).foregroundStyle(Color.ink).lineLimit(1)
                  Text("\(r.project) · \(r.date.formatted(.dateTime.month(.abbreviated).day()))")
                    .font(.system(size: 13)).foregroundStyle(Color.ink2)
                }
                .padding(.horizontal, 20).padding(.vertical, 9)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .contentShape(Rectangle())
              }
              .buttonStyle(.plain)
            }
          }
        }
        .padding(.bottom, 20)
      }
    }
  }

  private func row(_ icon: String, _ title: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      HStack(spacing: 14) {
        Image(systemName: icon).font(.system(size: 18)).frame(width: 26)
        Text(title).font(.system(size: 17))
        Spacer()
      }
      .foregroundStyle(Color.ink)
      .padding(.horizontal, 20)
      .frame(minHeight: 50)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }
}
