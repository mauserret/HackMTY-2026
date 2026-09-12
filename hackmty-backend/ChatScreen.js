// src/screens/ChatScreen.js
// Pantalla única con el input de texto y la lista de mensajes/componentes A2UI.
// El speech-to-text se conecta aquí después: en vez de escribir, grabas audio,
// lo mandas a transcribir (Whisper u otro), y llamas sendUserMessage() con el texto resultante.

import React, { useEffect, useState, useRef } from "react";
import { View, TextInput, FlatList, TouchableOpacity, Text, StyleSheet } from "react-native";
import { connectSocket, onMessage, sendUserMessage } from "../services/socket";
import DynamicUI from "../components/DynamicUI";

const USER_ID = "u1"; // en la demo real, cambia según qué usuario de los 4 esté "logueado"

export default function ChatScreen() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const listRef = useRef(null);

  useEffect(() => {
    connectSocket();
    const unsubscribe = onMessage((data) => {
      setMessages((prev) => [...prev, { from: "bot", data }]);
    });
    return unsubscribe;
  }, []);

  function handleSend() {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { from: "user", data: { type: "text", text: input } }]);
    sendUserMessage(USER_ID, input);
    setInput("");
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={item.from === "user" ? styles.userBubble : styles.botBubble}>
            <DynamicUI message={item.data} userId={USER_ID} />
          </View>
        )}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Escribe o usa el micrófono..."
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendText}>Enviar</Text>
        </TouchableOpacity>
        {/* TODO: botón de micrófono aquí -> graba audio -> transcribe -> sendUserMessage() */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 12, backgroundColor: "#f5f5f5" },
  userBubble: { alignSelf: "flex-end", maxWidth: "85%", marginVertical: 4 },
  botBubble: { alignSelf: "flex-start", maxWidth: "90%", marginVertical: 4 },
  inputRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  sendButton: { backgroundColor: "#EB0029", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendText: { color: "#fff", fontWeight: "bold" },
});
