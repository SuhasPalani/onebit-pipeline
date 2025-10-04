// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create or find Plaid provider
  let plaidProvider = await prisma.provider.findFirst({
    where: { name: 'Plaid' }
  })

  if (!plaidProvider) {
    plaidProvider = await prisma.provider.create({
      data: {
        name: 'Plaid',
        type: 'aggregator',
        status: 'active'
      }
    })
    console.log('✓ Plaid provider created:', plaidProvider.id)
  } else {
    console.log('✓ Plaid provider already exists:', plaidProvider.id)
  }

  // Create or find Yodlee provider
  let yodleeProvider = await prisma.provider.findFirst({
    where: { name: 'Yodlee' }
  })

  if (!yodleeProvider) {
    yodleeProvider = await prisma.provider.create({
      data: {
        name: 'Yodlee',
        type: 'aggregator',
        status: 'active'
      }
    })
    console.log('✓ Yodlee provider created:', yodleeProvider.id)
  } else {
    console.log('✓ Yodlee provider already exists:', yodleeProvider.id)
  }

  // Create categories (using upsert to avoid duplicates)
  const categories = [
    { name: 'Meals & Entertainment', gaapMap: 'Expense:Meals' },
    { name: 'Software', gaapMap: 'Expense:Software' },
    { name: 'Office Supplies', gaapMap: 'Expense:Office' },
    { name: 'Transportation', gaapMap: 'Expense:Transportation' },
    { name: 'Bank Fees', gaapMap: 'Expense:BankFees' },
    { name: 'Interest Income', gaapMap: 'Revenue:Interest' },
    { name: 'Shopping', gaapMap: 'Expense:Shopping' },
    { name: 'Transfer', isTransfer: true, gaapMap: 'Asset:Cash' },
    { name: 'Payment', isPayment: true, gaapMap: 'Liability:CreditCard' },
    { name: 'Uncategorized Expense', gaapMap: 'Expense:Uncategorized' },
    { name: 'Uncategorized Income', gaapMap: 'Revenue:Uncategorized' }
  ]

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: {
        name: category.name,
        gaapMap: category.gaapMap,
        isTransfer: category.isTransfer || false,
        isPayment: category.isPayment || false
      }
    })
  }
  console.log(`✓ Categories created/verified: ${categories.length}`)

  // Create sample accounts (only if they don't exist)
  const existingAccounts = await prisma.account.findMany({
    where: { userId: 'user-123' }
  })

  if (existingAccounts.length === 0) {
    const checkingAccount = await prisma.account.create({
      data: {
        userId: 'user-123',
        providerId: plaidProvider.id,
        institutionId: 'chase_bank',
        accountType: 'bank_checking',
        currency: 'USD',
        mask: '1234',
        displayName: 'Chase Checking'
      }
    })

    const savingsAccount = await prisma.account.create({
      data: {
        userId: 'user-123',
        providerId: plaidProvider.id,
        institutionId: 'chase_bank',
        accountType: 'bank_savings',
        currency: 'USD',
        mask: '5678',
        displayName: 'Chase Savings'
      }
    })

    const creditCardAccount = await prisma.account.create({
      data: {
        userId: 'user-123',
        providerId: yodleeProvider.id,
        institutionId: 'chase_credit',
        accountType: 'credit_card',
        currency: 'USD',
        mask: '9012',
        displayName: 'Chase Credit Card'
      }
    })

    console.log('✓ Sample accounts created:', {
      checking: checkingAccount.id,
      savings: savingsAccount.id,
      creditCard: creditCardAccount.id
    })
  } else {
    console.log('✓ Sample accounts already exist')
  }

  console.log('\n✅ Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })