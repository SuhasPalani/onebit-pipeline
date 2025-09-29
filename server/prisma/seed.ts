// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create providers
  const plaidProvider = await prisma.provider.create({
    data: {
      name: 'Plaid',
      type: 'aggregator',
      status: 'active'
    }
  })

  const yodleeProvider = await prisma.provider.create({
    data: {
      name: 'Yodlee',
      type: 'aggregator',
      status: 'active'
    }
  })

  // Create categories
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
    await prisma.category.create({ 
      data: {
        name: category.name,
        gaapMap: category.gaapMap,
        isTransfer: category.isTransfer || false,
        isPayment: category.isPayment || false
      }
    })
  }

  // Create sample accounts
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

  console.log('Database seeded successfully!')
  console.log(`Providers created: ${plaidProvider.id}, ${yodleeProvider.id}`)
  console.log(`Accounts created: ${checkingAccount.id}, ${savingsAccount.id}, ${creditCardAccount.id}`)
  console.log(`Categories created: ${categories.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })