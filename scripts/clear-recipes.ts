import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Si tu FK en RecipeItem -> Recipe tiene onDelete: Cascade (como te dejé),
  // con borrar Recipe basta. Si no, borra primero RecipeItem.
  await prisma.recipeItem.deleteMany({});
  await prisma.recipe.deleteMany({});
  console.log("✔ Recetas e ítems eliminados");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
