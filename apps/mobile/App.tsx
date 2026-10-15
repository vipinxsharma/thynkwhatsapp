import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { Image, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

const links = {
  workspace: "https://xeccel.com/login",
  privacy: "https://xeccel.com/legal/privacy",
  terms: "https://xeccel.com/legal/terms",
  support: "mailto:partner@thynkwise.co.in?subject=Xeccel%20mobile%20access",
} as const;

async function openLink(url: string) {
  if (await Linking.canOpenURL(url)) await Linking.openURL(url);
}

export default function App() {
  const dark = useColorScheme() === "dark";
  const palette = dark ? colors.dark : colors.light;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: palette.background }]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandCard}>
          <Image source={require("./assets/xeccel-logo.jpg")} resizeMode="contain"
            accessibilityLabel="Xeccel, powered by thynkWISE" style={styles.brand} />
        </View>
        <Text style={[styles.eyebrow, { color: palette.accent }]}>XECCEL MOBILE</Text>
        <Text style={[styles.title, { color: palette.heading }]}>Your team inbox, wherever work happens.</Text>
        <Text style={[styles.body, { color: palette.muted }]}>
          The Android and iOS apps are being built for Xeccel service teams. Mobile workspace sign-in and
          live conversations will be enabled only after secure account access and the WhatsApp channel are verified.
        </Text>

        <View style={[styles.panel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.panelTitle, { color: palette.heading }]}>Workspace access</Text>
          <Text style={[styles.panelBody, { color: palette.muted }]}>
            Your account and messages are not stored in this preview. Continue in the Xeccel web workspace for now.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void openLink(links.workspace)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Open web workspace</Text>
          </Pressable>
        </View>

        <View style={styles.footerLinks}>
          <Pressable accessibilityRole="link" onPress={() => void openLink(links.privacy)}>
            <Text style={[styles.link, { color: palette.heading }]}>Privacy</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => void openLink(links.terms)}>
            <Text style={[styles.link, { color: palette.heading }]}>Terms</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => void openLink(links.support)}>
            <Text style={[styles.link, { color: palette.heading }]}>Support</Text>
          </Pressable>
        </View>
        <Text style={[styles.disclosure, { color: palette.muted }]}>
          Operated by ThynkWISE Advisors Private Limited. This preview is not a live messaging client.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const colors = {
  light: { background: "#fefaf2", surface: "#ffffff", heading: "#142142", muted: "#4b5563", border: "#e6e8ec", accent: "#e07512" },
  dark: { background: "#0b132a", surface: "#142142", heading: "#ffffff", muted: "#cbd5e1", border: "#263557", accent: "#f38b26" },
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 28 },
  brandCard: { height: 118, borderRadius: 24, backgroundColor: "#020d2a", overflow: "hidden", marginBottom: 36 },
  brand: { width: "100%", height: "100%" },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 2, marginBottom: 10 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: "800", marginBottom: 14 },
  body: { fontSize: 16, lineHeight: 24, marginBottom: 28 },
  panel: { borderWidth: 1, borderRadius: 24, padding: 20 },
  panelTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  panelBody: { fontSize: 14, lineHeight: 21, marginBottom: 18 },
  primaryButton: { minHeight: 50, borderRadius: 25, backgroundColor: "#f38b26", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { fontSize: 15, fontWeight: "800", color: "#0b132a" },
  footerLinks: { flexDirection: "row", justifyContent: "center", gap: 24, marginTop: 34 },
  link: { fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
  disclosure: { textAlign: "center", fontSize: 12, lineHeight: 18, marginTop: 20 },
});
