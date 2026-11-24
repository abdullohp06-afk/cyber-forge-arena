# Кибер-Кузня: свой сервер на Orange Pi Zero 3

Сервер сам отдаёт игру и хранит аккаунты (имя + пароль) и сохранения в одном файле базы SQLite.
Сторонних пакетов нет, нужен только Node.js 22.13 или новее. Памяти берёт около 50–70 МБ из 1 ГБ.

Пароли не хранятся: в базе лежит только их хеш (scrypt с солью). Вход держится 60 дней.

## Установка (один раз)

Нужны: Orange Pi с Linux (Orange Pi OS, Armbian, Debian или Ubuntu), доступ по SSH и архив `cyberforge-server.zip`.

1. Узнай IP платы: в настройках роутера или командой `hostname -I` на самой плате.

2. С компьютера (PowerShell) отправь архив на плату. Вместо `ИМЯ` — твой пользователь на плате, вместо `IP` — её адрес:

   ```
   scp cyberforge-server.zip ИМЯ@IP:~/
   ```

3. Зайди на плату:

   ```
   ssh ИМЯ@IP
   ```

4. Поставь Node.js 24 и unzip:

   ```
   curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
   sudo apt-get install -y nodejs unzip
   node -v
   ```

   `node -v` должен показать v22.13 или новее.

5. Создай отдельного пользователя для сервера и распакуй игру:

   ```
   sudo useradd --system --no-create-home --shell /usr/sbin/nologin cyberforge
   sudo mkdir -p /opt/cyberforge/data
   sudo unzip -o ~/cyberforge-server.zip -d /opt/cyberforge
   sudo chown -R cyberforge:cyberforge /opt/cyberforge/data
   ```

6. Включи автозапуск:

   ```
   sudo cp /opt/cyberforge/server/cyberforge.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now cyberforge
   sudo systemctl status cyberforge
   ```

   В статусе должно быть `active (running)`.

7. Открой на телефоне или компьютере в той же Wi-Fi сети: `http://IP:8080`.
   Появится окно «Аккаунт»: создай аккаунт или играй без входа.

## Обновить игру

Собери новый архив на компьютере (`npm run pack:server`), отправь его как в шаге 2, затем на плате:

```
sudo unzip -o ~/cyberforge-server.zip -d /opt/cyberforge
sudo systemctl restart cyberforge
```

Аккаунты и сохранения лежат в `/opt/cyberforge/data` и при обновлении не трогаются.

## Резервная копия базы

```
sudo systemctl stop cyberforge
sudo cp /opt/cyberforge/data/cyberforge.db ~/cyberforge-backup-$(date +%F).db
sudo systemctl start cyberforge
```

Копию лучше потом забрать на компьютер: `scp ИМЯ@IP:~/cyberforge-backup-*.db .`

## Логи и проблемы

- Смотреть логи: `journalctl -u cyberforge -f`
- Порт занят: поменяй `PORT=8080` в `/etc/systemd/system/cyberforge.service`, затем `sudo systemctl daemon-reload && sudo systemctl restart cyberforge`
- Страница не открывается с телефона: телефон должен быть в той же сети, а адрес — `http://`, не `https://`

## Доступ из интернета

Не открывай порт 8080 на роутере напрямую: по `http://` пароль идёт по сети открытым текстом.
Безопасные варианты:

- **Tailscale** — друзья ставят приложение и заходят в твою частную сеть;
- **Cloudflare Tunnel** — даёт адрес с `https://` без настройки роутера.

С любым HTTPS-вариантом раскомментируй в `cyberforge.service` строки `COOKIE_SECURE=1` и `TRUST_PROXY=1`,
затем `sudo systemctl daemon-reload && sudo systemctl restart cyberforge`.

## Чего пока нет

- Восстановления забытого пароля и удаления аккаунта через интерфейс.
- Панели администратора.
