import React from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BankingProvider, useBanking } from "./src/context/BankingContext";
import MainTabs from "./src/navigation/MainTabs";
import LoginScreen from "./src/screens/LoginScreen";
import { colors } from "./src/theme";

function RootScreen() {
  const { session } = useBanking();
  return session ? <MainTabs /> : <LoginScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.app}>
        <StatusBar style="light" backgroundColor={colors.red} />
        <View style={styles.shell}>
          <BankingProvider>
            <RootScreen />
          </BankingProvider>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.canvasStrong,
  },
  shell: {
    flex: 1,
    width: "100%",
    maxWidth: 620,
    backgroundColor: colors.red,
  },
});
