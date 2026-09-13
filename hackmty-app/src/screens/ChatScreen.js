import React, { useCallback, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
  Image,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";

import Composer from "../components/Composer";
import DynamicUI from "../components/DynamicUI";
import NotificationBanner from "../components/NotificationBanner";
import LiveVoiceModal from "../components/LiveVoiceModal";
import { useBanking } from "../context/BankingContext";
import { colors, fontFamily, radii, spacing } from "../theme";

const WELCOME_UI = {
  type: "ui",
  component: "quick_actions",
  props: {
    title: "¿Qué quieres resolver hoy?",
    message:
      "Descríbelo con tus propias palabras y Ban-IA construirá una experiencia inteligente para ti.",
  },
};

export default function ChatScreen() {
  const {
    assistantStatus,
    confirmTransfer,
    confirmRegisterAccount,
    updateRegisteredAccount,
    deleteRegisteredAccount,
    connection,
    dismissNotification,
    messages,
    notification,
    rateInteraction,
    sendMessage,
  } = useBanking();
  const insets = useSafeAreaInsets();
  const listRef = useRef(null);

  // Estado para controlar el modal de voz tipo "Modo Live"
  const [isLiveModalVisible, setIsLiveModalVisible] = useState(false);

  const renderItem = useCallback(
    ({ item }) => {
      if (item.role === "user") {
        return (
          <View style={styles.userMessageRow}>
            <View style={styles.userBubble}>
              {item.inputMode === "voice" ? (
                <View style={styles.voiceLabel}>
                  <Ionicons name="mic" size={11} color="#FFD5DC" />
                  <Text style={styles.voiceLabelText}>DICTADO</Text>
                </View>
              ) : null}
              <Text style={styles.userText}>{item.data.text}</Text>
            </View>
          </View>
        );
      }

      return (
        <View style={styles.assistantMessageRow}>
          <View style={styles.agentMarker}>
            <Ionicons name="sparkles" size={13} color={colors.surface} />
          </View>
          <View style={styles.generatedContent}>
            <DynamicUI
              message={item.data}
              onConfirmTransfer={confirmTransfer}
              onConfirmRegisterAccount={confirmRegisterAccount}
              onUpdateRegisteredAccount={updateRegisteredAccount}
              onDeleteRegisteredAccount={deleteRegisteredAccount}
              onSendMessage={sendMessage}
              onRate={rateInteraction}
              savedRating={item.rating}
            />
          </View>
        </View>
      );
    },
    [
      confirmRegisterAccount,
      confirmTransfer,
      deleteRegisteredAccount,
      rateInteraction,
      sendMessage,
      updateRegisteredAccount,
    ],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      
      {/* HEADER SUPERIOR INSTITUCIONAL CON LOGOTIPO */}
      <View style={styles.appHeader}>
        <Image 
          source={require("../assets/logo.png")} 
          style={styles.headerLogoImage} 
          resizeMode="contain" 
        />
        <View style={styles.headerRightActions}>
          <View style={styles.onlinePill}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>En línea</Text>
          </View>
          <View style={styles.badgeIconButton}>
            <Text style={styles.badgeIconLetter}>B</Text>
          </View>
          <View style={styles.logoutButton}>
            <Feather name="message-square" size={18} color="#EB0029" />
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.canvasHeading}>
          <View>
            <Text style={styles.canvasEyebrow}>ASISTENTE INTELIGENTE</Text>
            <Text style={styles.canvasTitle}>Ban-IA Workspace</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN LÍNEA</Text>
          </View>
        </View>

        {connection !== "connected" ? (
          <View style={styles.offlineBar}>
            <Ionicons
              name="cloud-offline-outline"
              size={15}
              color={colors.warning}
            />
            <Text style={styles.offlineText}>
              Reconectando con tu sesión segura de Banorte…
            </Text>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          style={styles.feed}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.feedContent,
            messages.length === 0 && styles.emptyFeedContent,
          ]}
          ListEmptyComponent={
            <View style={styles.welcomeCanvas}>
              <DynamicUI
                message={WELCOME_UI}
                onConfirmTransfer={confirmTransfer}
                onConfirmRegisterAccount={confirmRegisterAccount}
                onUpdateRegisteredAccount={updateRegisteredAccount}
                onDeleteRegisteredAccount={deleteRegisteredAccount}
                onSendMessage={sendMessage}
                onRate={rateInteraction}
              />
            </View>
          }
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
        />

        {/* COMPOSER CON ACCESO AL MODO LIVE */}
        <Composer
          onSend={sendMessage}
          disabled={connection !== "connected"}
          assistantStatus={assistantStatus}
          bottomInset={Math.min(insets.bottom, 16)}
          onPressVoice={() => setIsLiveModalVisible(true)}
        />
      </KeyboardAvoidingView>

      {/* MODAL MODO LIVE */}
      <LiveVoiceModal
        visible={isLiveModalVisible}
        onClose={() => setIsLiveModalVisible(false)}
        assistantStatus={assistantStatus}
      />

      <NotificationBanner
        notification={notification}
        onDismiss={dismissNotification}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: '#EB0029',
  },
  appHeader: {
    height: 56,
    backgroundColor: '#EB0029',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#D30024'
  },
  headerLogoImage: {
    width: 130,
    height: 32,
    tintColor: '#FFFFFF',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2ECC71',
  },
  onlineText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  badgeIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconLetter: {
    color: '#EB0029',
    fontWeight: 'bold',
    fontSize: 13,
  },
  logoutButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasHeading: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  canvasEyebrow: {
    color: '#EB0029',
    fontFamily: 'Gotham-Bold',
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  canvasTitle: {
    color: '#323648',
    fontFamily: 'Gotham-Bold',
    fontSize: 16,
    fontWeight: "700",
    marginTop: 1,
  },
  liveBadge: {
    height: 23,
    borderRadius: radii.pill,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2ECC71',
  },
  liveText: {
    color: '#2ECC71',
    fontFamily: 'Gotham-Bold',
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  offlineBar: {
    minHeight: 31,
    backgroundColor: colors.warningSoft,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  offlineText: {
    color: colors.warning,
    fontFamily: 'Gotham-Bold',
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 6,
  },
  feed: {
    flex: 1,
    backgroundColor: '#F4F5F7',
  },
  welcomeCanvas: {
    width: "100%",
    justifyContent: "center",
  },
  feedContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: 13,
  },
  emptyFeedContent: {
    justifyContent: "center",
  },
  userMessageRow: {
    width: "100%",
    alignItems: "flex-end",
  },
  userBubble: {
    maxWidth: "84%",
    backgroundColor: '#5B6670', // Gris Banorte aplicado en las burbujas
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  userText: {
    color: '#FFFFFF',
    fontFamily: 'Gotham-Bold',
    fontSize: 13,
    lineHeight: 18,
  },
  voiceLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 3,
  },
  voiceLabelText: {
    color: "#FFD5DC",
    fontFamily: 'Gotham-Bold',
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  assistantMessageRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  agentMarker: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#EB0029',
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
    marginTop: 3,
  },
  generatedContent: {
    flex: 1,
  },
});