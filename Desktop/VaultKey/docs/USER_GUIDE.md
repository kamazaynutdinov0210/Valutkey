# VaultKey user guide

VaultKey keeps your passwords locked on your own phone or computer. You unlock them with one master password. Nothing is sent to anyone, and nobody, including whoever runs the website, can read or reset your passwords for you.

## The three things to understand first
1. **Master password.** The one password you remember. It unlocks everything. Make it long (a few random words is best) and never reuse it.
2. **Recovery key.** A long code shown once when you set up. It is the **only** way back in if you forget the master password. Write it on paper or store it somewhere safe that is not on this device.
3. **Backups.** Your passwords live in your browser. If the browser clears its data, or you lose the device, a backup file is how you get them back. Save one now and then.

---

## Install the app

You can use VaultKey in a normal browser tab, but installing it gives you an icon, a full-screen window, and the best offline behaviour.

### Android (Chrome or Edge)
1. Open the VaultKey address in Chrome.
2. Open **Settings** in VaultKey and tap **Install VaultKey**, or open the browser menu (three dots) and tap **Install app** / **Add to Home screen**.
3. Open it from the new icon on your home screen.

### iPhone or iPad (Safari)
1. Open the VaultKey address in **Safari** (not another app's browser).
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open it from the home-screen icon.

Safari can delete the saved data of websites you have not opened for about a week, unless the site is added to the Home Screen. Install it, and keep a backup.

### Windows, Mac or Linux (Chrome or Edge)
1. Open the VaultKey address.
2. Click the **install icon** at the right end of the address bar (a small screen with a down arrow), or open the browser menu and choose **Install VaultKey**.
3. It opens in its own window and appears in your Start menu or Applications folder.

### Firefox and Safari on a Mac
These browsers cannot install web apps in the same way. VaultKey still works in a tab.

---

## First-time setup
1. Open VaultKey. On the first screen, choose a **Master password**. Tap **Suggest a passphrase** if you want VaultKey to pick seven random words for you.
2. Type it again, then tap **Create my vault**. This takes a moment.
3. **Save your recovery key.** Tap **Copy recovery key** and paste it somewhere safe, or write it down. Tick **I saved my recovery key in a safe place**, then **Continue**.

VaultKey needs at least 12 characters and a strength rating of "Okay" or better.

## Everyday use

### Add a password
1. In the **Vault** tab, tap **Add password**.
2. Give it a **Title**. Fill in the username and website if you like.
3. Tap **Generate** to make a strong password, or type your own. A meter shows how strong it is.
4. Optional: choose **Remind me to change this password** and how often. Add tags (like "work") separated by commas.
5. Tap **Save**.

### Find and use a password
- Type in **Search**, or tap a tag to filter.
- Tap an entry. The password is hidden: tap **Show password** to see it, **Copy password** to copy it.
- A copied password is removed from your clipboard after 30 seconds, and when VaultKey locks.
- **Edit** changes it. **Delete** asks you to confirm.

### The Generator tab
Make a password or a passphrase of any length, choose which kinds of characters to use, avoid look-alike characters, and tap **Generate** then **Copy**.
Under it, **Check a password you already use** rates one you type (it is not saved), and **Hash some text (advanced)** is a tool for developers.

### Reminders
- The **Reminders** tab lists what is **Overdue** and **Due soon**. A number on the tab and a notice at the top of the Vault tell you when something is due.
- Tap **Change password for ...**. VaultKey suggests a new password. **Change it on the website first**, then tap **Save new password**. The old one is kept in the entry's history.
- Settings has **Tell me when passwords are due** for a short notification (it never names a password).

### Locking
VaultKey locks by itself after a few minutes of no use (change this in Settings) and when you close it. **Lock now** is in Settings.

---

## Backups and other devices (Settings → Backup and sync)

### Save a backup file
Tap **Save a backup file**. Put the file somewhere you trust, such as your cloud drive. It is locked with your master password and recovery key. Anyone who gets it could try to guess your master password, so keep it private.

### Use a new phone or computer, or recover after your browser cleared its data
1. Install and open VaultKey. On the first screen tap **I already have a backup file**.
2. Choose the file and enter the master password you used when it was made. If you have changed it since, tick **Use my recovery key instead**.

### Keep two devices in step
- **On Chrome or Edge on a computer:** tap **Choose sync file** and pick a file inside your cloud folder (Dropbox, OneDrive, iCloud Drive, Google Drive). Tap **Sync now** whenever you want. Sync one device at a time, and let your cloud finish uploading before you sync another.
- **Anywhere else:** save a backup into your cloud folder, and on the other device use **Choose a backup file to merge**. Newer changes win, deletions carry over, and if the same password was changed on both devices, the older one is kept in that entry's history.

## Security (Settings → Security)
- **Change master password.** Your passwords are not re-encrypted. Your other devices ask for the new one after they next sync.
- **Make a new recovery key.** Use it if the old one was lost or seen by someone. The old key stops working.
- **Unlock with fingerprint, face or device PIN.** Faster than typing. It works on this device only, and the master password always still works.
- **Make a new vault key (advanced).** Use it only if you think your master password was seen **and** someone may have a copy of your data (for example a backup file). It locks everything again with a brand-new key. Your other devices and old backup files will stop working with this vault: delete them, then use **Replace this vault with a backup file** on each device.

## If something goes wrong
| Problem | What to do |
|---|---|
| I forgot my master password | On the lock screen tap **I forgot my password**, enter your recovery key, and choose a new master password. |
| I lost the recovery key but I am still signed in | Settings → Security → **Make a new recovery key**. |
| I forgot the master password **and** lost the recovery key | Your passwords cannot be recovered. That is the price of nobody else being able to read them. Restore an older backup only works with the password it had. |
| My data disappeared | Browsers can clear site data. Restore from your latest backup (first screen: **I already have a backup file**). |
| A file is "damaged or has been changed" | VaultKey refuses it on purpose. Use another copy. |
| It says a copy is older than one it has seen | A cloud service may have restored an old version. Merging it will not remove anything newer. Choose **Merge anyway** only if you trust the source. |
| Notifications do not appear | Allow notifications for VaultKey in your browser or phone settings. Closed-app reminders only work in some installed apps (Chrome/Edge). |
| The unlock-with-fingerprint button does not appear | It must be turned on in Settings → Security on that device, and the device must support passkeys. |

## Good habits
- Use a long master password you have not used anywhere else.
- Keep the recovery key on paper, away from your device.
- Save a backup after you add important passwords.
- Keep your device's own lock screen on, and your browser up to date.
- VaultKey does not fill in websites for you. Copy and paste, and check you are on the real site.
