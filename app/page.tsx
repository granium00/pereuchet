export default function HomePage() {
  return (
    <section className="card">
      <div className="tag">Старт сессии</div>
      <h1 style={{ marginTop: 12, marginBottom: 8 }}>Выберите роль</h1>
      <p className="choice-desc" style={{ marginBottom: 20 }}>
        Каждый новый визит начинается с выбора — ввод или просмотр данных.
      </p>
      <div className="grid-two">
        <a className="choice" href="/input">
          <div className="choice-title">Ввод данных</div>
          <div className="choice-desc">
            Добавляйте строки, отправляйте их в общий поток.
          </div>
        </a>
        <a className="choice" href="/view">
          <div className="choice-title">Просмотр данных</div>
          <div className="choice-desc">
            Смотрите общий список и копируйте нужные значения.
          </div>
        </a>
      </div>
    </section>
  );
}
