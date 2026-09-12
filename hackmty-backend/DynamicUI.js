// src/components/DynamicUI.js
// El corazón del "A2UI": recibe el mensaje del backend y decide qué componente
// pintar. Cada "case" es un tipo de componente que ustedes diseñan — aquí van
// 4 de ejemplo que cubren el flujo de la demo (balance, contactos, transferencia,
// plan de crédito). Agreguen más conforme crezca el reto.

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { confirmTransfer } from "../services/socket";

export default function DynamicUI({ message, userId }) {
  if (!message) return null;

  if (message.type === "text") {
    return <Text style={styles.text}>{message.text}</Text>;
  }

  if (message.type === "error") {
    return <Text style={[styles.text, styles.error]}>⚠ {message.message}</Text>;
  }

  if (message.type === "ui") {
    switch (message.component) {
      case "balance_card":
        return <BalanceCard data={message.props} />;
      case "contacts_list":
        return <ContactsList data={message.props} />;
      case "transfer_form":
        return <TransferForm data={message.props} userId={userId} />;
      case "transfer_success":
        return <TransferSuccess data={message.props} />;
      case "credit_plan_table":
        return <CreditPlanTable data={message.props} />;
      default:
        return <Text style={styles.text}>Componente desconocido: {message.component}</Text>;
    }
  }

  return null;
}

function BalanceCard({ data }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{data.name}</Text>
      {data.accounts.map((acc) => (
        <Text key={acc.account_id} style={styles.text}>
          {acc.type}: ${acc.balance ?? acc.balance_owed}
        </Text>
      ))}
    </View>
  );
}

function ContactsList({ data }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Tus contactos</Text>
      {data.contacts.map((c) => (
        <Text key={c.contact_user_id} style={styles.text}>
          • {c.alias}
        </Text>
      ))}
    </View>
  );
}

// Formulario simplificado: en la demo real, el monto vendría de otro input
// de texto/voz ("deposítale 1500"); aquí se deja un monto fijo para probar el flujo.
function TransferForm({ data, userId }) {
  const amount = 1500;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Confirmar transferencia</Text>
      <Text style={styles.text}>
        Enviar ${amount} a {data.suggested_contact}
      </Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => confirmTransfer(userId, data.suggested_contact, amount)}
      >
        <Text style={styles.buttonText}>Confirmar</Text>
      </TouchableOpacity>
    </View>
  );
}

function TransferSuccess({ data }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>✅ Transferencia completada</Text>
      <Text style={styles.text}>${data.amount} enviados a la cuenta {data.to_account}</Text>
    </View>
  );
}

function CreditPlanTable({ data }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Reestructura tu saldo de ${data.balance}</Text>
      {data.options.map((opt) => (
        <Text key={opt.months} style={styles.text}>
          {opt.months} meses · CAT {opt.cat}% · ${opt.monthly_payment}/mes
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardTitle: { fontWeight: "bold", fontSize: 16, marginBottom: 8 },
  text: { fontSize: 14, marginVertical: 2 },
  error: { color: "red" },
  button: {
    marginTop: 12,
    backgroundColor: "#EB0029",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
});
