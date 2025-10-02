import { Router } from 'express'
import ingestRouter from './ingest'
import accountsRouter from './accounts'
import transactionsRouter from './transactions'
import transfersRouter from './transfers'
import classicRouter from './classifications'
import reconciliationRouter from './reconciliation'
import plaidRouter from './plaid'  // ADD THIS

const router = Router()

router.use('/ingest', ingestRouter)
router.use('/accounts', accountsRouter)
router.use('/transactions', transactionsRouter)
router.use('/transfers', transfersRouter)
router.use('/classifications', classicRouter)
router.use('/reconciliation', reconciliationRouter)
router.use('/plaid', plaidRouter)  // ADD THIS

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default router