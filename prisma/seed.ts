/**
 * SCRIPT DE SEED OPTIIA
 *
 * Lance ce fichier pour peupler ta base avec des données fictives :
 *  - 5 fournisseurs
 *  - 30 produits (montures, verres, lentilles, accessoires)
 *  - 50 clients
 *  - 40 ordonnances
 *  - ~150 ventes étalées sur 12 mois
 *  - 20 rendez-vous
 *  - Stock pour chaque produit
 *
 * Comment lancer :
 *   pnpm tsx prisma/seed.ts
 * (depuis le dossier backend/)
 *
 * Si tsx n'est pas installé : pnpm add -D tsx
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ⚠️ IDs DE TON COMPTE — déjà remplis pour toi
const TENANT_ID = 'cmot5xqc10001yl4wzyfwg03s';
const STORE_ID = 'cmot5xqc10002yl4w0v9adh4s';
const USER_ID = 'cmot5xqcg0006yl4wkseub3iu';

// ---------- Helpers ----------

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const pickMany = <T>(arr: T[], n: number): T[] => {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return result;
};
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);

// ---------- Données fictives ----------

const FIRST_NAMES_M = ['Pierre', 'Jean', 'Antoine', 'Lucas', 'Hugo', 'Maxime', 'Théo', 'Nathan', 'Paul', 'Louis', 'Gabriel', 'Arthur', 'Adam', 'Ethan', 'Léo'];
const FIRST_NAMES_F = ['Marie', 'Sophie', 'Camille', 'Emma', 'Léa', 'Chloé', 'Manon', 'Inès', 'Sarah', 'Julie', 'Anna', 'Louise', 'Alice', 'Jade', 'Lina'];
const LAST_NAMES = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier', 'Blanc', 'Guérin'];
const CITIES = [
  { city: 'Nantes', cp: '44000' },
  { city: 'Saint-Nazaire', cp: '44600' },
  { city: 'La Baule', cp: '44500' },
  { city: 'Pornic', cp: '44210' },
  { city: 'Guérande', cp: '44350' },
];
const DOCTORS = ['Dr. Lambert', 'Dr. Rousseau', 'Dr. Faure', 'Dr. Chevalier', 'Dr. Mercier', 'Dr. Garnier'];

// ---------- Seed ----------

async function main() {
  console.log('🌱 Démarrage du seed OptiIA…\n');

  // Vérifier que les IDs existent
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT_ID } });
  if (!tenant) {
    console.error('❌ Tenant introuvable. Vérifie TENANT_ID en haut du fichier.');
    process.exit(1);
  }
  console.log(`✓ Tenant trouvé : ${tenant.name}`);

  // ----- 1. FOURNISSEURS -----
  console.log('\n📦 Création des fournisseurs…');
  const suppliersData = [
    { name: 'Luxottica', email: 'commandes@luxottica.fr', leadTimeDays: 10 },
    { name: 'Safilo Group', email: 'orders@safilo.com', leadTimeDays: 14 },
    { name: 'Marchon Eyewear', email: 'fr@marchon.com', leadTimeDays: 12 },
    { name: 'Essilor France', email: 'pro@essilor.fr', leadTimeDays: 7 },
    { name: 'Acuvue Distribution', email: 'pro@acuvue.fr', leadTimeDays: 5 },
  ];
  const suppliers = [];
  for (const s of suppliersData) {
    const sup = await prisma.supplier.create({
      data: { tenantId: TENANT_ID, ...s },
    });
    suppliers.push(sup);
  }
  console.log(`  ✓ ${suppliers.length} fournisseurs créés`);

  // ----- 2. PRODUITS -----
  console.log('\n👓 Création des produits…');

  const frames = [
    { brand: 'Ray-Ban', name: 'Wayfarer Classic', sku: 'RB-WAY-001', sellPriceTtc: 159, costPriceHt: 65, color: 'Noir', shape: 'Rectangle', material: 'Acétate', size: 'M', supplierIdx: 0 },
    { brand: 'Ray-Ban', name: 'Aviator Gold', sku: 'RB-AVI-002', sellPriceTtc: 189, costPriceHt: 75, color: 'Or', shape: 'Aviator', material: 'Métal', size: 'L', supplierIdx: 0 },
    { brand: 'Ray-Ban', name: 'Clubmaster', sku: 'RB-CLU-003', sellPriceTtc: 169, costPriceHt: 70, color: 'Écaille', shape: 'Mixte', material: 'Acétate/Métal', size: 'M', supplierIdx: 0 },
    { brand: 'Persol', name: '649 Original', sku: 'PER-649-004', sellPriceTtc: 249, costPriceHt: 110, color: 'Havane', shape: 'Rectangle', material: 'Acétate', size: 'M', supplierIdx: 0 },
    { brand: 'Oakley', name: 'Holbrook', sku: 'OAK-HOL-005', sellPriceTtc: 179, costPriceHt: 75, color: 'Noir mat', shape: 'Carrée', material: 'O Matter', size: 'L', supplierIdx: 0 },
    { brand: 'Oakley', name: 'Frogskins', sku: 'OAK-FRO-006', sellPriceTtc: 149, costPriceHt: 60, color: 'Bleu', shape: 'Carrée', material: 'Plastique', size: 'M', supplierIdx: 0 },
    { brand: 'Carrera', name: 'Champion 65', sku: 'CAR-CHA-007', sellPriceTtc: 139, costPriceHt: 55, color: 'Noir', shape: 'Aviator', material: 'Métal', size: 'M', supplierIdx: 1 },
    { brand: 'Polaroid', name: 'PLD 6044', sku: 'POL-6044-008', sellPriceTtc: 89, costPriceHt: 32, color: 'Bordeaux', shape: 'Ronde', material: 'Acétate', size: 'S', supplierIdx: 1 },
    { brand: 'Tom Ford', name: 'FT5179', sku: 'TF-5179-009', sellPriceTtc: 349, costPriceHt: 150, color: 'Noir brillant', shape: 'Rectangle', material: 'Acétate', size: 'M', supplierIdx: 2 },
    { brand: 'Tom Ford', name: 'FT5634', sku: 'TF-5634-010', sellPriceTtc: 379, costPriceHt: 165, color: 'Havane', shape: 'Papillon', material: 'Acétate', size: 'M', supplierIdx: 2 },
    { brand: 'Lacoste', name: 'L2870', sku: 'LAC-2870-011', sellPriceTtc: 119, costPriceHt: 48, color: 'Bleu marine', shape: 'Rectangle', material: 'Acétate', size: 'L', supplierIdx: 2 },
    { brand: 'Hugo Boss', name: 'BOSS 1234', sku: 'HB-1234-012', sellPriceTtc: 199, costPriceHt: 85, color: 'Gris', shape: 'Rectangle', material: 'Métal', size: 'L', supplierIdx: 2 },
    { brand: 'Vogue', name: 'VO5318', sku: 'VOG-5318-013', sellPriceTtc: 109, costPriceHt: 42, color: 'Rose', shape: 'Œil de chat', material: 'Acétate', size: 'S', supplierIdx: 0 },
    { brand: 'Prada', name: 'PR 17WV', sku: 'PRA-17WV-014', sellPriceTtc: 329, costPriceHt: 140, color: 'Noir', shape: 'Rectangle', material: 'Acétate', size: 'M', supplierIdx: 0 },
    { brand: 'Gucci', name: 'GG0396O', sku: 'GUC-0396-015', sellPriceTtc: 349, costPriceHt: 145, color: 'Tortue', shape: 'Rectangle', material: 'Acétate', size: 'M', supplierIdx: 0 },
  ];

  const lenses = [
    { brand: 'Essilor', name: 'Varilux Comfort', sku: 'ESS-VAR-001', sellPriceTtc: 449, costPriceHt: 180, lensIndex: 1.6, lensTreatment: ['AR', 'BLUE_LIGHT'], supplierIdx: 3, subcategory: 'progressive' },
    { brand: 'Essilor', name: 'Crizal Easy', sku: 'ESS-CRI-002', sellPriceTtc: 199, costPriceHt: 75, lensIndex: 1.5, lensTreatment: ['AR'], supplierIdx: 3, subcategory: 'single_vision' },
    { brand: 'Essilor', name: 'Varilux X 1.67', sku: 'ESS-VARX-003', sellPriceTtc: 599, costPriceHt: 250, lensIndex: 1.67, lensTreatment: ['AR', 'BLUE_LIGHT', 'PHOTOCHROMIC'], supplierIdx: 3, subcategory: 'progressive' },
    { brand: 'Hoya', name: 'Hoyalux iD', sku: 'HOY-IDS-004', sellPriceTtc: 379, costPriceHt: 155, lensIndex: 1.6, lensTreatment: ['AR'], supplierIdx: 3, subcategory: 'progressive' },
    { brand: 'Zeiss', name: 'DriveSafe', sku: 'ZEI-DRV-005', sellPriceTtc: 289, costPriceHt: 115, lensIndex: 1.6, lensTreatment: ['AR'], supplierIdx: 3, subcategory: 'single_vision' },
  ];

  const contactLenses = [
    { brand: 'Acuvue', name: 'Oasys Boîte 6', sku: 'ACU-OAS-006', sellPriceTtc: 35, costPriceHt: 14, supplierIdx: 4 },
    { brand: 'Acuvue', name: 'Oasys 1-Day Boîte 30', sku: 'ACU-1D30-007', sellPriceTtc: 39, costPriceHt: 16, supplierIdx: 4 },
    { brand: 'Acuvue', name: 'Oasys 1-Day Boîte 90', sku: 'ACU-1D90-008', sellPriceTtc: 99, costPriceHt: 42, supplierIdx: 4 },
    { brand: 'Biofinity', name: 'Boîte 6', sku: 'BIO-006-009', sellPriceTtc: 32, costPriceHt: 13, supplierIdx: 4 },
    { brand: 'Dailies', name: 'Total 1 Boîte 30', sku: 'DAI-T130-010', sellPriceTtc: 42, costPriceHt: 17, supplierIdx: 4 },
  ];

  const accessories = [
    { brand: null, name: 'Étui rigide premium', sku: 'ACC-ETU-001', sellPriceTtc: 19, costPriceHt: 5 },
    { brand: null, name: 'Microfibre x3', sku: 'ACC-MIC-002', sellPriceTtc: 9, costPriceHt: 2 },
    { brand: null, name: 'Cordon lunettes', sku: 'ACC-COR-003', sellPriceTtc: 12, costPriceHt: 3 },
  ];

  const solutions = [
    { brand: 'Renu', name: 'MultiPlus 360ml', sku: 'SOL-RNU-001', sellPriceTtc: 11, costPriceHt: 4 },
    { brand: 'Aosept', name: 'Plus HydraGlyde', sku: 'SOL-AOS-002', sellPriceTtc: 14, costPriceHt: 5 },
  ];

  const allProducts: any[] = [];

  // Créer les montures
  for (const f of frames) {
    const p = await prisma.product.create({
      data: {
        tenantId: TENANT_ID,
        sku: f.sku,
        name: f.name,
        brand: f.brand,
        category: 'FRAME',
        subcategory: 'optical',
        sellPriceTtc: f.sellPriceTtc,
        costPriceHt: f.costPriceHt,
        frameMaterial: f.material,
        frameColor: f.color,
        frameShape: f.shape,
        frameSize: f.size,
        supplierId: suppliers[f.supplierIdx].id,
      },
    });
    allProducts.push(p);
  }
  // Créer les verres
  for (const l of lenses) {
    const p = await prisma.product.create({
      data: {
        tenantId: TENANT_ID,
        sku: l.sku,
        name: l.name,
        brand: l.brand,
        category: 'LENS',
        subcategory: l.subcategory,
        sellPriceTtc: l.sellPriceTtc,
        costPriceHt: l.costPriceHt,
        lensIndex: l.lensIndex,
        lensTreatment: l.lensTreatment,
        supplierId: suppliers[l.supplierIdx].id,
      },
    });
    allProducts.push(p);
  }
  // Créer les lentilles
  for (const c of contactLenses) {
    const p = await prisma.product.create({
      data: {
        tenantId: TENANT_ID,
        sku: c.sku,
        name: c.name,
        brand: c.brand,
        category: 'CONTACT_LENS',
        sellPriceTtc: c.sellPriceTtc,
        costPriceHt: c.costPriceHt,
        supplierId: suppliers[c.supplierIdx].id,
      },
    });
    allProducts.push(p);
  }
  // Accessoires & solutions
  for (const a of accessories) {
    const p = await prisma.product.create({
      data: { tenantId: TENANT_ID, ...a, category: 'ACCESSORY' },
    });
    allProducts.push(p);
  }
  for (const s of solutions) {
    const p = await prisma.product.create({
      data: { tenantId: TENANT_ID, ...s, category: 'SOLUTION' },
    });
    allProducts.push(p);
  }
  console.log(`  ✓ ${allProducts.length} produits créés`);

  // ----- 3. STOCK -----
  console.log('\n📊 Création du stock initial…');
  for (const p of allProducts) {
    // Verres = pas de stock physique (sur commande)
    if (p.category === 'LENS') continue;
    await prisma.stockItem.create({
      data: {
        tenantId: TENANT_ID,
        productId: p.id,
        storeId: STORE_ID,
        quantity: rand(1, 15),
        reorderPoint: 3,
        reorderQty: 8,
      },
    });
  }
  console.log('  ✓ Stock initialisé');

  // ----- 4. CLIENTS -----
  console.log('\n👥 Création des clients…');
  const clients = [];
  for (let i = 0; i < 50; i++) {
    const isMale = Math.random() > 0.5;
    const firstName = isMale ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
    const lastName = pick(LAST_NAMES);
    const cityData = pick(CITIES);
    const birthYear = rand(1945, 2010);
    const phone = `0${pick(['6', '7'])}${rand(10, 99)}${rand(10, 99)}${rand(10, 99)}${rand(10, 99)}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.fr`;

    const client = await prisma.client.create({
      data: {
        tenantId: TENANT_ID,
        storeId: STORE_ID,
        firstName,
        lastName,
        email,
        phone,
        birthDate: new Date(birthYear, rand(0, 11), rand(1, 28)),
        gender: isMale ? 'M' : 'F',
        city: cityData.city,
        postalCode: cityData.cp,
        addressLine1: `${rand(1, 200)} rue ${pick(['des Lilas', 'de la République', 'Victor Hugo', 'du Commerce', 'Pasteur'])}`,
        preferredBrands: Math.random() > 0.6 ? pickMany(['Ray-Ban', 'Persol', 'Oakley', 'Tom Ford'], 2) : [],
        averageBudget: rand(150, 500),
        tags: Math.random() > 0.7 ? pickMany(['VIP', 'fidèle', 'presbyte', 'sportif'], 2) : [],
      },
    });
    clients.push(client);
  }
  console.log(`  ✓ ${clients.length} clients créés`);

  // ----- 5. ORDONNANCES -----
  console.log('\n🩺 Création des ordonnances…');
  let prescriptionsCount = 0;
  for (const client of clients) {
    if (Math.random() > 0.85) continue; // 15% des clients sans ordonnance

    const nbRx = rand(1, 3);
    const age = new Date().getFullYear() - client.birthDate!.getFullYear();
    const isPresbyte = age >= 45;

    for (let i = 0; i < nbRx; i++) {
      const issuedAt = daysAgo(rand(30, 365 * 3));
      await prisma.prescription.create({
        data: {
          tenantId: TENANT_ID,
          clientId: client.id,
          type: 'GLASSES',
          status: 'VALIDATED',
          doctorName: pick(DOCTORS),
          doctorRpps: `1019${rand(10000, 99999)}`,
          issuedAt,
          validUntil: new Date(issuedAt.getTime() + 3 * 365 * 24 * 3600 * 1000),
          odSphere: (rand(-600, 200) / 100).toFixed(2) as any,
          odCylinder: Math.random() > 0.5 ? (rand(-200, 0) / 100).toFixed(2) as any : null,
          odAxis: Math.random() > 0.5 ? rand(0, 180) : null,
          odAddition: isPresbyte ? (rand(75, 300) / 100).toFixed(2) as any : null,
          ogSphere: (rand(-600, 200) / 100).toFixed(2) as any,
          ogCylinder: Math.random() > 0.5 ? (rand(-200, 0) / 100).toFixed(2) as any : null,
          ogAxis: Math.random() > 0.5 ? rand(0, 180) : null,
          ogAddition: isPresbyte ? (rand(75, 300) / 100).toFixed(2) as any : null,
          pupillaryDistance: rand(56, 70),
          validatedById: USER_ID,
        },
      });
      prescriptionsCount++;
    }
  }
  console.log(`  ✓ ${prescriptionsCount} ordonnances créées`);

  // ----- 6. VENTES -----
  console.log('\n💰 Création des ventes (peut prendre 30s…)…');
  let salesCount = 0;
  let saleRefCounter = 1;

  const productsForSale = allProducts.filter((p) => p.category !== 'LENS' || Math.random() > 0.5);

  for (const client of clients) {
    const nbSales = rand(0, 5);
    for (let i = 0; i < nbSales; i++) {
      const createdAt = daysAgo(rand(1, 365));
      const nbItems = rand(1, 3);
      const selectedProducts = pickMany(productsForSale, nbItems);
      if (selectedProducts.length === 0) continue;

      let subtotalHt = 0;
      let totalTtc = 0;
      const itemsData: any[] = [];

      for (const p of selectedProducts) {
        const qty = p.category === 'CONTACT_LENS' || p.category === 'SOLUTION' ? rand(1, 4) : 1;
        const sellTtc = Number(p.sellPriceTtc);
        const vatRate = Number(p.vatRate);
        const unitPriceHt = sellTtc / (1 + vatRate / 100);
        const lineHt = unitPriceHt * qty;
        const lineTtc = sellTtc * qty;

        subtotalHt += lineHt;
        totalTtc += lineTtc;

        itemsData.push({
          productId: p.id,
          description: `${p.brand ?? ''} ${p.name}`.trim(),
          quantity: qty,
          unitPriceHt: unitPriceHt.toFixed(2),
          vatRate,
          totalHt: lineHt.toFixed(2),
          totalTtc: lineTtc.toFixed(2),
        });
      }

      const vatAmount = totalTtc - subtotalHt;
      const status = pick(['DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'READY', 'PENDING']);

      await prisma.sale.create({
        data: {
          tenantId: TENANT_ID,
          storeId: STORE_ID,
          clientId: client.id,
          reference: `V-2026-${String(saleRefCounter++).padStart(5, '0')}`,
          status,
          subtotalHt: subtotalHt.toFixed(2),
          vatAmount: vatAmount.toFixed(2),
          totalTtc: totalTtc.toFixed(2),
          paidAmount: status === 'DELIVERED' ? totalTtc.toFixed(2) : '0',
          createdAt,
          updatedAt: createdAt,
          deliveredAt: status === 'DELIVERED' ? createdAt : null,
          items: { create: itemsData },
        },
      });
      salesCount++;
    }
  }
  console.log(`  ✓ ${salesCount} ventes créées`);

  // ----- 7. RENDEZ-VOUS -----
  console.log('\n📅 Création des rendez-vous…');
  let aptCount = 0;
  const appointmentTypes = ['EXAM', 'FITTING', 'PICKUP', 'CONSULTATION'] as const;
  for (let i = 0; i < 20; i++) {
    const client = pick(clients);
    const isFuture = i < 8;
    const startsAt = isFuture
      ? new Date(Date.now() + rand(1, 30) * 24 * 3600 * 1000)
      : daysAgo(rand(1, 60));
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    const status = isFuture
      ? pick(['SCHEDULED', 'CONFIRMED'] as const)
      : pick(['COMPLETED', 'COMPLETED', 'NO_SHOW'] as const);

    await prisma.appointment.create({
      data: {
        tenantId: TENANT_ID,
        storeId: STORE_ID,
        clientId: client.id,
        userId: USER_ID,
        type: pick(appointmentTypes),
        status,
        startsAt,
        endsAt,
      },
    });
    aptCount++;
  }
  console.log(`  ✓ ${aptCount} rendez-vous créés`);

  console.log('\n✅ SEED TERMINÉ AVEC SUCCÈS !');
  console.log('\n📊 Résumé :');
  console.log(`   • ${suppliers.length} fournisseurs`);
  console.log(`   • ${allProducts.length} produits`);
  console.log(`   • ${clients.length} clients`);
  console.log(`   • ${prescriptionsCount} ordonnances`);
  console.log(`   • ${salesCount} ventes`);
  console.log(`   • ${aptCount} rendez-vous`);
  console.log('\n🚀 Tu peux maintenant tester le chat IA — il aura plein de données !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
