// Mot de passe de secours : npm run set-password -- <email> <mot de passe>
const { setPasswordFor } = require('../lib/auth');

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage : npm run set-password -- <email> <mot de passe>');
  process.exit(1);
}
setPasswordFor(email, password)
  .then(() => console.log(`Mot de passe de ${email} mis à jour (sessions fermées).`))
  .catch((e) => { console.error(e.message); process.exit(1); });
