import express from 'express';

const router = express.Router();

router.post('/', (req, res) => {
  res.json({
    message: 'Seed route working'
  });
});

export default router;
