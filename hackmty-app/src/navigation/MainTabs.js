import React from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import ChatScreen from "../screens/ChatScreen";
import DashboardScreen from "../screens/DashboardScreen";
import StatisticsScreen from "../screens/StatisticsScreen";
import { colors, fontFamily } from "../theme";

const Tab = createBottomTabNavigator();

const icons = {
  Inicio: ["home", "home-outline"],
  Chat: ["chatbubble-ellipses", "chatbubble-ellipses-outline"],
  Estadísticas: ["stats-chart", "stats-chart-outline"],
};

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.red,
    background: colors.canvas,
    card: colors.surface,
    text: colors.charcoal,
    border: colors.border,
  },
};

export default function MainTabs() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        initialRouteName="Inicio"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.red,
          tabBarInactiveTintColor: colors.slate,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
          tabBarLabelStyle: styles.tabLabel,
          sceneStyle: styles.scene,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={icons[route.name][focused ? 0 : 1]}
              size={Math.max(size, 21)}
              color={color}
            />
          ),
        })}
      >
        <Tab.Screen
          name="Inicio"
          component={DashboardScreen}
          options={{ tabBarAccessibilityLabel: "Pestaña Inicio" }}
        />
        <Tab.Screen
          name="Chat"
          component={ChatScreen}
          options={{ tabBarAccessibilityLabel: "Pestaña Chat" }}
        />
        <Tab.Screen
          name="Estadísticas"
          component={StatisticsScreen}
          options={{ tabBarAccessibilityLabel: "Pestaña Estadísticas" }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  scene: {
    backgroundColor: colors.canvas,
  },
  tabBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: 5,
  },
  tabItem: {
    minHeight: 52,
  },
  tabLabel: {
    fontFamily,
    fontSize: 10,
    fontWeight: "700",
    paddingBottom: 2,
  },
});
