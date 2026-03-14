const axios = require("axios");

module.exports.config = {
  name: "fbgen",
  version: "1.0.0",
  hasPermission: 0,
  credits: "Yasis",
  description: "Generate Facebook accounts automatically with a custom password",
  commandCategory: "tools",
  usages: "fbgen <number of accounts to create (max 5)>",
  cooldowns: 2,
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;

  // Get the number of accounts to create
  let numAccounts = parseInt(args[0]);

  // Validate the number of accounts (max 5)
  if (isNaN(numAccounts) || numAccounts < 1 || numAccounts > 5) {
    return api.sendMessage(
      "❌ Please provide a valid number of accounts to generate (1-5).",
      threadID,
      messageID
    );
  }

  try {
    // Array to store the generated account details
    let accountDetails = [];

    // Create accounts in a loop
    for (let i = 0; i < numAccounts; i++) {
      console.log(`Generating account ${i + 1}...`);

      // Step 1: Generate a temporary email using the tempmail API
      const emailResponse = await axios.get(
        "https://vern-rest-api.vercel.app/api/tempmail"
      );
      if (!emailResponse.data.email) {
        throw new Error("Failed to generate temporary email.");
      }
      const tempEmail = emailResponse.data.email;
      console.log(`Generated temp email: ${tempEmail}`);

      // Step 2: Register Facebook account using the generated email
      const registerResponse = await axios.post(
        "https://autocreate-account-api.onrender.com/register",
        {
          email: tempEmail,
          password: "yasis123", // Custom password
        }
      );
      if (!registerResponse.data) {
        throw new Error("Failed to register Facebook account.");
      }
      const accountInfo = registerResponse.data;
      console.log(`Account registered: ${accountInfo.username}`);

      // Step 3: Fetch OTP from the temporary inbox
      const inboxResponse = await axios.get(
        `https://vern-rest-api.vercel.app/api/tempmail?email=${tempEmail}`
      );
      if (!inboxResponse.data.otp) {
        throw new Error("OTP not found.");
      }
      const otp = inboxResponse.data.otp;
      console.log(`OTP received: ${otp}`);

      // Step 4: You can add logic to send OTP and finalize registration if required.
      // For now, we assume that the account is generated successfully once OTP is fetched.

      accountDetails.push({
        email: tempEmail,
        username: accountInfo.username,
        password: "yasis123", // Custom password
        accountId: accountInfo.accountId,
        otp,
        link: `https://facebook.com/${accountInfo.username}`,
      });
    }

    // Step 5: Send the response with the details of the generated accounts
    let message = "🎉 Facebook Accounts Generated Successfully!\n\n";
    accountDetails.forEach((account, index) => {
      message += `Account #${index + 1}:\n`;
      message += `• Email: ${account.email}\n`;
      message += `• Username: ${account.username}\n`;
      message += `• Password: ${account.password}\n`;
      message += `• Account ID: ${account.accountId}\n`;
      message += `• OTP: ${account.otp}\n`;
      message += `• Link: ${account.link}\n\n`;
    });

    // Send the formatted account details back to the user
    return api.sendMessage(message, threadID, messageID);
  } catch (err) {
    console.error("Error generating accounts:", err.message);
    return api.sendMessage(
      `❌ Failed to generate accounts. Error: ${err.message}`,
      threadID,
      messageID
    );
  }
};