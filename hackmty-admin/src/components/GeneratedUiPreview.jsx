import { componentLabel, formatDate, formatMoney, maskClabe } from "../utils/format";

const CHART_COLORS = ["#eb0029", "#323e48", "#147a5b", "#9a5d00", "#547aa5", "#8d6a9f"];

function resolveUi(response, fallbackComponent) {
  let payload = response;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload)) {
    return resolveUi(
      payload.find((item) => item?.type === "ui" || item?.component) || payload[0],
      fallbackComponent,
    );
  }
  if (payload.response && payload.response !== payload) {
    return resolveUi(payload.response, payload.component || fallbackComponent);
  }
  const component = payload.component || fallbackComponent;
  if (!component) return null;
  return {
    component,
    props: payload.props && typeof payload.props === "object" ? payload.props : payload,
  };
}

function PreviewCard({ eyebrow, title, accent, children }) {
  return (
    <article className="ui-card">
      <span className="ui-card__accent" style={{ background: accent || "#eb0029" }} />
      <header className="ui-card__header">
        <span style={{ color: accent || "#eb0029" }}>{eyebrow}</span>
        <h4>{title}</h4>
      </header>
      {children}
    </article>
  );
}

function Field({ label, value, hint }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="ui-field">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

function Receipt({ rows }) {
  return (
    <dl className="ui-receipt">
      {rows
        .filter((row) => row.value)
        .map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd className={row.success ? "ui-receipt__ok" : undefined}>{row.value}</dd>
          </div>
        ))}
    </dl>
  );
}

function ChartPreview({ data }) {
  const series = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.series)
      ? data.series
      : [];
  const maxValue = Math.max(1, ...series.map((item) => Number(item.value) || 0));
  const total = series.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const chartType = ["bar", "pie", "line"].includes(data.chartType)
    ? data.chartType
    : "bar";

  if (!series.length) {
    return <p className="ui-empty">Sin series para graficar.</p>;
  }

  if (chartType === "pie") {
    let consumed = 0;
    const gradient = series
      .map((item, index) => {
        const start = consumed;
        consumed += total ? ((Number(item.value) || 0) / total) * 100 : 0;
        return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${consumed}%`;
      })
      .join(", ");
    return (
      <div className="ui-pie">
        <div
          className="ui-pie__ring"
          style={{ background: `conic-gradient(${gradient})` }}
        >
          <div>
            <span>TOTAL</span>
            <strong>{formatMoney(total, data.currency)}</strong>
          </div>
        </div>
        <ul>
          {series.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              <i style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
              <span>{item.label}</span>
              <strong>{formatMoney(item.value, data.currency)}</strong>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (chartType === "line") {
    const points = series
      .map((item, index) => {
        const x = series.length <= 1 ? 50 : (index / (series.length - 1)) * 100;
        const y = 92 - ((Number(item.value) || 0) / maxValue) * 76;
        return `${x},${y}`;
      })
      .join(" ");
    return (
      <div className="ui-line">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline fill="none" stroke="#eb0029" strokeWidth="2" points={points} />
        </svg>
        <div>
          {series.map((item, index) => (
            <span key={`${item.label}-${index}`}>{item.label}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ui-bars">
      {series.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          <strong>{formatMoney(item.value, data.currency)}</strong>
          <span
            style={{
              height: `${Math.max(6, ((Number(item.value) || 0) / maxValue) * 110)}px`,
              background: CHART_COLORS[index % CHART_COLORS.length],
            }}
          />
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
}

function BalancePreview({ data }) {
  const accounts = data.accounts || [];
  const checking = accounts.find((account) => account.type === "checking");
  const credit = accounts.find((account) => account.type === "credit_card");
  const checkingBalance = data.checking_balance ?? checking?.balance ?? data.balance;
  const creditBalance = data.credit_balance ?? credit?.balance_owed ?? credit?.balance;
  const creditLimit = data.credit_limit ?? credit?.credit_limit;
  const ownerName = data.name || data.user?.name;
  return (
    <PreviewCard
      eyebrow="INTERFAZ GENERADA"
      title={ownerName ? `Saldos de ${String(ownerName).split(" ")[0]}` : "Tus saldos"}
    >
      <div className="ui-hero">
        <span>DISPONIBLE EN CUENTA</span>
        <strong>{formatMoney(checkingBalance)}</strong>
      </div>
      {creditBalance !== undefined ? (
        <div className="ui-row">
          <div>
            <strong>Tarjeta de crédito</strong>
            <small>{creditLimit ? `Límite ${formatMoney(creditLimit)}` : "Saldo utilizado"}</small>
          </div>
          <b>{formatMoney(creditBalance)}</b>
        </div>
      ) : null}
    </PreviewCard>
  );
}

function ContactsPreview({ data }) {
  const contacts = Array.isArray(data) ? data : data.contacts || [];
  return (
    <PreviewCard
      eyebrow={`${contacts.length} CUENTAS REGISTRADAS`}
      title={data.title || "Tus cuentas registradas"}
    >
      {data.message ? <p className="ui-copy">{data.message}</p> : null}
      {contacts.length ? (
        <ul className="ui-list">
          {contacts.map((contact) => {
            const name = contact.name || contact.alias || contact.display_name;
            return (
              <li key={contact.contact_id || contact.id || name}>
                <span className="ui-avatar">{String(name || "?").slice(0, 1)}</span>
                <div>
                  <strong>{name}</strong>
                  <small>CLABE {maskClabe(contact.clabe || contact.accountNumber)}</small>
                  {contact.holder_name ? (
                    <small>Titular original: {contact.holder_name}</small>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="ui-empty">Sin cuentas registradas.</p>
      )}
    </PreviewCard>
  );
}

function TransferFormPreview({ data }) {
  const initial = data.initialValues || {};
  const recipient =
    initial.recipient || data.registered_name || data.to_alias || data.suggested_contact;
  const amount = initial.amount ?? data.amount;
  const concept = initial.concept ?? data.concept;
  const clabe = initial.accountNumber || initial.clabe || data.clabe || data.account_number;
  return (
    <PreviewCard eyebrow="CONFIRMACIÓN REQUERIDA" title={data.title || "Revisa tu transferencia"}>
      <Field label="Cuenta destino" value={recipient || "Sin destinatario"} hint={maskClabe(clabe)} />
      <Field label="Monto" value={formatMoney(amount)} hint="MXN" />
      <Field label="Concepto" value={concept || "Sin concepto"} />
      <button className="ui-primary" disabled type="button">
        Confirmar transferencia
      </button>
    </PreviewCard>
  );
}

function RegisterFormPreview({ data }) {
  const initial = data.initialValues || data;
  return (
    <PreviewCard eyebrow="ALTA DE CUENTA" title={data.title || "Registrar cuenta"}>
      <Field label="Nombre" value={initial.name} />
      <Field label="CLABE" value={initial.clabe || initial.accountNumber} />
      <Field label="Banco" value={initial.bank || "Banorte"} />
      <button className="ui-primary" disabled type="button">
        Guardar cuenta
      </button>
    </PreviewCard>
  );
}

function TransferSuccessPreview({ data }) {
  const recipient =
    data.registered_name ||
    data.recipient_name ||
    data.recipient ||
    data.to_alias ||
    "destinatario";
  return (
    <article className="ui-success">
      <div className="ui-success__icon">✓</div>
      <span>OPERACIÓN COMPLETADA</span>
      <h4>Transferencia exitosa</h4>
      <strong>{formatMoney(data.amount)}</strong>
      <p>Enviados a {recipient}</p>
      <Receipt
        rows={[
          {
            label: "Fecha",
            value: data.date || data.created_at ? formatDate(data.date || data.created_at) : "",
          },
          {
            label: "Folio",
            value: String(data.transaction_id || data.transactionId || "").slice(-12).toUpperCase(),
          },
          { label: "Concepto", value: data.concept },
          { label: "Estado", value: "Completada", success: true },
        ]}
      />
    </article>
  );
}

function TransactionsPreview({ data }) {
  const groups = data.groups || [];
  const totals = data.totals || {};
  const flat = data.transactions || groups.flatMap((group) => group.transactions || []);
  return (
    <PreviewCard eyebrow="HISTORIAL FINANCIERO" title={data.title || "Resumen de operaciones"}>
      <div className="ui-totals">
        <div>
          <span>ENTRADAS</span>
          <strong className="ui-in">{formatMoney(totals.incoming)}</strong>
        </div>
        <div>
          <span>SALIDAS</span>
          <strong className="ui-out">{formatMoney(totals.outgoing)}</strong>
        </div>
      </div>
      {flat.length ? (
        <ul className="ui-list">
          {flat.slice(0, 8).map((transaction) => {
            const incoming = transaction.direction === "incoming";
            return (
              <li key={transaction.transactionId || transaction.transaction_id}>
                <span className={`ui-flow ${incoming ? "ui-flow--in" : "ui-flow--out"}`}>
                  {incoming ? "↓" : "↑"}
                </span>
                <div>
                  <strong>
                    {incoming ? transaction.sender : transaction.recipient}
                  </strong>
                  <small>{transaction.concept || transaction.category}</small>
                </div>
                <b className={incoming ? "ui-in" : undefined}>
                  {incoming ? "+" : "−"}
                  {formatMoney(transaction.amount)}
                </b>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="ui-empty">{data.empty_message || "No hay operaciones para mostrar."}</p>
      )}
    </PreviewCard>
  );
}

function TransactionDetailPreview({ data }) {
  const transaction = data.transaction || data;
  const incoming = transaction.direction === "incoming";
  return (
    <PreviewCard
      eyebrow="COMPROBANTE"
      title={data.title || "Detalle de operación"}
      accent={incoming ? "#147a5b" : "#eb0029"}
    >
      <div className="ui-hero">
        <span>{incoming ? "TRANSFERENCIA RECIBIDA" : "TRANSFERENCIA ENVIADA"}</span>
        <strong>{formatMoney(transaction.amount, transaction.currency)}</strong>
        <small>
          {incoming ? `De ${transaction.sender}` : `A ${transaction.recipient}`}
        </small>
      </div>
      <Receipt
        rows={[
          { label: "Fecha", value: formatDate(transaction.timestamp || transaction.created_at) },
          { label: "Concepto", value: transaction.concept || "Sin concepto" },
          { label: "Categoría", value: transaction.category },
          { label: "Cuenta", value: transaction.accountNumber ? maskClabe(transaction.accountNumber) : "" },
          { label: "Banco", value: transaction.bank },
          { label: "Folio", value: String(transaction.transactionId || "").toUpperCase() },
          {
            label: "Estado",
            value: transaction.status === "completed" ? "Completada" : transaction.status,
            success: transaction.status === "completed",
          },
        ]}
      />
    </PreviewCard>
  );
}

function CreditPreview({ data }) {
  const options = data.options || [];
  const totalDebt = data.total_debt ?? data.balance ?? data.current_balance;
  return (
    <PreviewCard eyebrow="COMPARATIVA PERSONALIZADA" title="Opciones para pagar mejor">
      <div className="ui-hero">
        <span>SALDO A REESTRUCTURAR</span>
        <strong>{formatMoney(totalDebt)}</strong>
      </div>
      <ul className="ui-plans">
        {options.map((option, index) => (
          <li key={option.months} className={index === 1 ? "ui-plans__selected" : undefined}>
            <b>{option.months} meses</b>
            <span>{formatMoney(option.monthly_payment)} / mes</span>
            <small>CAT {option.cat}%</small>
          </li>
        ))}
      </ul>
    </PreviewCard>
  );
}

function ActionsPreview({ data, title, eyebrow, accent }) {
  const choices = data.actions || data.choices || data.options || data.quick_actions || [];
  return (
    <PreviewCard eyebrow={eyebrow} title={title} accent={accent}>
      {data.message || data.description ? (
        <p className="ui-copy">{data.message || data.description}</p>
      ) : null}
      {choices.length ? (
        <ul className="ui-actions">
          {choices.map((choice, index) => (
            <li key={`${choice.label || choice}-${index}`}>
              {typeof choice === "string" ? choice : choice.label}
            </li>
          ))}
        </ul>
      ) : null}
    </PreviewCard>
  );
}

function renderComponent(component, data) {
  switch (component) {
    case "balance_card":
      return <BalancePreview data={data} />;
    case "contacts_list":
      return <ContactsPreview data={data} />;
    case "transfer_form":
      return <TransferFormPreview data={data} />;
    case "register_account_form":
      return <RegisterFormPreview data={data} />;
    case "register_account_success": {
      const account = data.account || data;
      return (
        <PreviewCard eyebrow="LISTO" title={data.title || "Cuenta registrada"} accent="#147a5b">
          <p className="ui-copy">
            Guardamos “{account.name || account.alias}” con CLABE {maskClabe(account.clabe || account.accountNumber)}.
          </p>
        </PreviewCard>
      );
    }
    case "transfer_success":
      return <TransferSuccessPreview data={data} />;
    case "credit_plan_table":
      return <CreditPreview data={data} />;
    case "financial_chart":
      return (
        <PreviewCard eyebrow="ANÁLISIS GENERADO" title={data.title || "Actividad financiera"}>
          {data.message ? <p className="ui-copy">{data.message}</p> : null}
          <ChartPreview data={data} />
        </PreviewCard>
      );
    case "transactions_summary":
      return <TransactionsPreview data={data} />;
    case "transaction_detail":
      return <TransactionDetailPreview data={data} />;
    case "clarification_card":
      return (
        <ActionsPreview
          accent="#9a5d00"
          data={data}
          eyebrow="CONFIRMEMOS CONTIGO"
          title={data.title || "Solo necesito un dato más"}
        />
      );
    case "quick_actions":
      return (
        <ActionsPreview
          data={data}
          eyebrow="ACCIONES RÁPIDAS"
          title={data.title || "¿Qué quieres hacer?"}
        />
      );
    default:
      return (
        <PreviewCard eyebrow="COMPONENTE DESCONOCIDO" title={componentLabel(component)}>
          <p className="ui-empty">No hay una vista previa para este componente.</p>
        </PreviewCard>
      );
  }
}

export default function GeneratedUiPreview({ response, component }) {
  const ui = resolveUi(response, component);
  if (!ui) {
    return <p className="ui-empty">No se pudo reconstruir la interfaz generada.</p>;
  }

  return (
    <div className="ui-phone" aria-label="Vista previa de la interfaz generada">
      <div className="ui-phone__notch" />
      <div className="ui-phone__screen">{renderComponent(ui.component, ui.props || {})}</div>
    </div>
  );
}
