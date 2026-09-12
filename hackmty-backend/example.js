// example.js
// Ejemplo mínimo de cómo llamar las funciones desde tu servidor (Express, WS, etc.)
// Corre esto solo para probar que la conexión y las tools funcionan:
//   node example.js

const { connectDB, closeDB } = require("./db");
const { getBalance, getContacts, createTransaction, getCreditPlans } = require("./mcpTools");

async function main() {
  await connectDB();

  console.log(await getBalance("u1"));
  console.log(await getContacts("u1"));
  console.log(await getCreditPlans("acc_u1_credit"));

  // Simula lo que el LLM haría al interpretar "haz una transacción a Timoteo"
  const tx = await createTransaction("u1", "Timoteo", 1500);
  console.log("Transacción creada:", tx);

  await closeDB();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
