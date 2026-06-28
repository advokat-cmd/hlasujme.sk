import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log("Použitie: npx tsx scripts/create-admin.ts <email> <meno> <heslo>");
    process.exit(1);
  }

  const [email, name, password] = args;

  console.log(`Vytváram admin účet pre: ${name} (${email})...`);

  // Hash hesla pomocou argon2id (rovnako ako pri prihlasovaní)
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id
  });

  const admin = await prisma.admin.create({
    data: {
      email,
      name,
      passwordHash,
      role: "admin",
    }
  });

  console.log(`Administrátor ${email} bol úspešne vytvorený.`);
}

main()
  .catch((e) => {
    console.error("Chyba pri vytváraní administrátora:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
