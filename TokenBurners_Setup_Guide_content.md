# Setup Guide

This guide walks you through setting up the API keys required by the desktop application.
Complete each setup section in order.

---

## Setup 1: Gemini API Key

Follow the steps below to create a Google Gemini API key and add it to the desktop application.

### Step 1: Open Google AI Studio

Open the following website in your browser:

**https://aistudio.google.com/**

Sign in using your Google account if you are asked to do so.

### Step 2: Open the API Key Page

Once you are signed in:

1. Look for **Get API key** in Google AI Studio.
2. Click **Get API key**.

### Step 3: Create the API Key

On the API key page:

1. Click **Create API key**.
2. Google may ask you to select a Google Cloud project.
3. If you already have a project, select it.
4. If you do not have one, choose the option to create a new project.
5. Wait for Google to generate the API key.

### Step 4: Copy the API Key

Once the API key is created:

1. Click the **Copy** button next to the API key.
2. Keep the copied API key ready for the next step.

The API key will look similar to:

    AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

The actual key generated for you will be different.

### Step 5: Add the API Key to the Desktop Application

1. Open the desktop application and go to **Settings**.
2. Scroll down to the **AI assistant** section.
3. In the **Provider** dropdown, select **Google Gemini**.
4. Paste the API key you copied in Step 4 into the **API key** box, then click the **Save**
   button next to it.
5. Click **Test connection**. You should see the message **Connection OK**.
6. Click **Save changes** at the top right of the Settings page.

> **Important:** the **API key** field applies to whichever **Provider** is selected above it.
> If the Provider is left on the default, the Gemini key is stored against the wrong provider
> and the AI features will not work. **Save changes** is what keeps the provider choice — the
> **Save** button only stores the key.

If the test works and Save changes is done, the Gemini API key has been configured.

---

## Setup 2: Calendarific API Key

Follow the steps below to create a Calendarific API key and add it to the desktop application.
This key keeps the festival dates correct every year.

### Step 1: Create a Calendarific Account

1. Open the following website in your browser: **https://calendarific.com/**
2. Sign up for a new account through the Calendarific Sign Up portal.

### Step 2: Log Into Your Dashboard

1. Log into your account on the Calendarific website.
2. Go to your **Account** page: **https://calendarific.com/account**

### Step 3: Copy the API Key

1. On the Account page, find the **API key** section.
2. Copy your unique API key string.

### Step 4: Add the API Key to the Desktop Application

1. Open the desktop application and go to **Settings**.
2. Scroll down to the **Festival calendar sync** section.
3. In the **Provider** dropdown, make sure **Calendarific** is selected (it is the default).
4. Paste the API key you copied in Step 3 into the **API key** box, then click the **Save**
   button next to it.
5. Click **Test**. You should see the message **Holiday API OK**.
6. Make sure the switch **"Keep festival dates updated automatically"** is turned on.
7. Click **Save changes** at the top right of the Settings page.

Once saved, the app refreshes this year's and next year's festival dates by itself. You can
also do it on demand: open **Festival Messages**, choose the year, click **Sync dates**,
review the list and click **Apply**.

---

## Setup 3: Automated WhatsApp Messages

Follow the steps below to set up automated WhatsApp messaging via the Meta (Facebook)
WhatsApp Cloud API.

### Step 1: Create the Meta App

1. Go to **https://developers.facebook.com/** and log in with a Facebook account. (Create a
   plain Facebook account if you don't have one.)
2. Click the top-right menu -> **My Apps** -> **Create App**.
3. Use case: choose **Other** -> Next. App type: **Business** -> Next.
4. App name: **Sadguru RO Connect**. Enter your email. Click **Create app**.
5. On the app dashboard, find **WhatsApp** and click **Set up**.
6. If asked, create or select a **Meta Business Account** (name it "Sadguru Enterprise").

### Step 2: Get the Three Values the App Needs

Open **WhatsApp -> API Setup** in the left menu. You will see:

1. **Temporary access token** — a long code. It works for 24 hours (fine for testing). Copy it.
2. **Phone number ID** — a number under the test phone number. Copy it.
3. A test **"From" number** provided by Meta, and a box to add **"To" numbers** — add your
   own mobile number here so you can receive the test.

### Step 3: Put Them in the App

1. Go to **Settings -> WhatsApp Cloud API**.
2. **Dry-run** switch: leave it **ON** for now.
3. **Phone number ID**: paste the number from Step 2.
4. **Access token**: paste the temporary token, click **Save** (it is stored encrypted).
5. Click **Save changes** at the top right.
6. In the **Test number** box, type your own mobile (10 digits, e.g. `9825012345`) and click
   **Send test message**. Because Dry-run is on, it only appears on the **Activity** screen
   as "dry-run".
7. Now turn **Dry-run OFF**, click **Save changes**, and press **Send test message** again.
   A WhatsApp message should arrive on your phone within a few seconds.

If it fails, the exact reason from WhatsApp is shown on the **Activity** screen (for example
"Invalid OAuth access token" means the token expired — get a fresh one from API Setup).

### Step 4: For Everyday Use (Do This Within a Day or Two)

The temporary token dies after 24 hours and the test number can only message a few saved
numbers. To send to all your customers, you need three more things:

1. **A permanent token.** In the Meta app: **Business Settings -> Users -> System users** ->
   add a system user -> select the new system user and click **Assign Assets** -> select
   your app and toggle **Manage app** under Full control, then select your WhatsApp account
   and toggle **Manage WhatsApp Business accounts** under Full control -> click **Generate
   token** for your app with the `whatsapp_business_messaging` permission. Paste this token
   into the app's **Access token** box and Save. It does not expire.
2. **A real phone number**, added and verified under **WhatsApp -> API Setup -> Add phone
   number** (a number not already on the normal WhatsApp app).
3. **Approved message templates.** To message customers who have not messaged you first (e.g.
   reminders and festival greetings), Meta requires a pre-approved template. Under
   **WhatsApp -> Message Templates**, create one — for example name `service_reminder`,
   category **Utility**, body: `{{1}}` (one variable = the customer's name). Submit for
   review — approval is usually a few minutes to a day.

In the app: **Settings -> WhatsApp** -> put the template name in **Approved template name**
and the language code (`en` or `gu`) in **Template language code**, then **Save changes**.
