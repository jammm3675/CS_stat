# Как получить ключи для проекта Predictor & Analyzer

Чтобы запустить приложение, вам понадобятся три ключа, которые нужно будет добавить в файл `.env`:

- `FACEIT_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_KEY`

Вот пошаговая инструкция, как их получить.

---

### 1. Как получить ключ FACEIT Data API

Ключ API от FACEIT нужен для получения данных об игроках и матчах.

1.  **Перейдите на портал разработчиков FACEIT:**
    *   Откройте в браузере страницу [FACEIT Developers](https://developers.faceit.com/).
    *   Войдите в свою учетную запись FACEIT. Если у вас ее нет, создайте.

2.  **Создайте новое приложение:**
    *   После входа в систему вы попадете на страницу "My Apps" (Мои приложения).
    *   Нажмите на кнопку **"Create Application"** (Создать приложение).
    *   Заполните форму:
        *   **Application Name** (Название приложения): `Predictor & Analyzer`
        *   **Application Description** (Описание): `Telegram Mini App for analyzing FACEIT matches.`
        *   **Application URL** (URL приложения): Можете указать URL вашего будущего приложения на Render или просто ссылку на ваш GitHub репозиторий.
    *   Нажмите **"Create"**.

3.  **Получите API Key:**
    *   После создания приложения вы будете перенаправлены на его страницу.
    *   Найдите раздел **"API Keys"** (Ключи API).
    *   Вам нужен **"Server Side API Key"**. Скопируйте его.

4.  **Вставьте ключ в файл `.env`:**
    *   Откройте файл `.env` в корне вашего проекта.
    *   Вставьте скопированный ключ в строку `FACEIT_API_KEY`:
        ```
        FACEIT_API_KEY=ваш_скопированный_ключ_от_faceit
        ```

---

### 2. Как получить URL и ключ Supabase

Supabase мы будем использовать как базу данных для хранения никнеймов пользователей и истории их матчей.

1.  **Зарегистрируйтесь на Supabase:**
    *   Перейдите на сайт [Supabase](https://supabase.com/).
    *   Нажмите **"Start your project"** и зарегистрируйтесь (можно использовать аккаунт GitHub).

2.  **Создайте новый проект:**
    *   После регистрации вас перенаправит в панель управления (Dashboard).
    *   Нажмите **"New Project"** (Новый проект).
    *   Выберите организацию (обычно создается автоматически).
    *   Заполните данные проекта:
        *   **Name** (Название): `faceit-predictor`
        *   **Database Password** (Пароль от базы данных): Создайте надежный пароль и **обязательно сохраните его в надежном месте**. Он понадобится, если вы захотите подключиться к базе напрямую.
        *   **Region** (Регион): Выберите регион, который ближе всего к вам (например, `EU (Frankfurt)`).
        *   **Pricing Plan** (Тариф): Выберите **Free Tier** (Бесплатный тариф).
    *   Нажмите **"Create new project"**. Создание проекта может занять пару минут.

3.  **Найдите URL и API ключ проекта:**
    *   Когда проект будет создан, перейдите в его настройки. Слева в меню найдите иконку шестеренки (**Settings**).
    *   В настройках выберите раздел **"API"**.
    *   На этой странице вы найдете все, что нам нужно:
        *   **Project URL** (URL проекта): Найдите поле `URL` в секции **Project API keys**. Скопируйте его.
        *   **Project API Key (anon public)**: В той же секции найдите ключ с названием `anon` `public`. Это **безопасный** ключ, который можно использовать на стороне клиента. Скопируйте его.

4.  **Вставьте ключи в файл `.env`:**
    *   Вернитесь в ваш проект и откройте файл `.env`.
    *   Вставьте скопированные URL и ключ в соответствующие строки:
        ```
        SUPABASE_URL=ваш_скопированный_url_из_supabase
        SUPABASE_KEY=ваш_скопированный_anon_public_ключ
        ```

---

### Готово!

После того как вы заполните все три поля в файле `.env`, ваше приложение будет готово к работе с внешними сервисами.

**Важно:** Никогда не делитесь содержимым вашего `.env` файла и не загружайте его в публичные репозитории. Файл `.gitignore` уже настроен так, чтобы этого не произошло.

---

### 3. Схема базы данных Supabase

После создания проекта в Supabase вам нужно будет создать две таблицы: `users` и `match_history`.

1.  В левом меню вашей панели управления Supabase выберите иконку таблицы (**Table Editor**).
2.  Нажмите **"New table"** (Новая таблица) и создайте таблицу `users`.
3.  Затем снова нажмите **"New table"** и создайте `match_history`.

Либо вы можете выполнить готовый SQL-запрос.

1.  В левом меню выберите иконку SQL (**SQL Editor**).
2.  Нажмите **"New query"** (Новый запрос).
3.  Скопируйте и вставьте код ниже и нажмите **"RUN"**.

```sql
-- Таблица для хранения пользователей
CREATE TABLE users (
  id BIGINT PRIMARY KEY, -- ID пользователя из Telegram
  faceit_nickname VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица для хранения истории матчей
CREATE TABLE match_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT REFERENCES users(id),
  match_id VARCHAR(255) NOT NULL,
  win_probability FLOAT,
  weak_link_nickname VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица для хранения данных про-игроков (для функции "Сравнение с Про")
CREATE TABLE pro_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  faceit_id VARCHAR(255) UNIQUE NOT NULL,
  -- Здесь можно хранить их средние показатели, чтобы не дергать API постоянно,
  -- но для начала достаточно ID
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Наполняем таблицу несколькими известными игроками
-- Важно: эти FACEIT ID могут устареть. Их нужно будет проверить.
INSERT INTO pro_players (name, faceit_id) VALUES
  ('donk', 'c0e39b99-1b0d-4a7b-8b0a-2b0c3d9b1b3a'),
  ('ZywOo', 'bf7b6a03-7030-45a3-b233-a33748f3b015'),
  ('m0NESY', '8f828e83-2617-464c-96a5-711d9b329c38'),
  ('s1mple', '0df9ad5c-8e39-4a4c-9304-68802d380e11');

-- Функция для получения случайного про-игрока
CREATE OR REPLACE FUNCTION get_random_pro_player()
RETURNS SETOF pro_players AS $$
BEGIN
  RETURN QUERY SELECT * FROM pro_players ORDER BY RANDOM() LIMIT 1;
END;
$$ LANGUAGE plpgsql;

```
