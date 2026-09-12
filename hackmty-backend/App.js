// App.js
import React from "react";
import { SafeAreaView, StatusBar } from "react-native";
import ChatScreen from "./src/screens/ChatScreen";

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      <ChatScreen />
    </SafeAreaView>
  );
}
