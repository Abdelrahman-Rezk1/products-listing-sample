export default () => ({
    accounts: process.env.ZOHOSA_ACCOUNTS,
    clientID: process.env.ZOHO_CLIENT_ID,
    secret: process.env.ZOHO_CLIENT_SECRET,
    redirectURI: process.env.ZOHO_REDIRECT_URI,
    scopes: process.env.ZOHO_SCOPES,
});
  