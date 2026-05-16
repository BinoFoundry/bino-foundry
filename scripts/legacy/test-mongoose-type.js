const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  type: { type: String, default: 'test' }
});
const M = mongoose.model('M', schema);
const m = new M({ type: 'hello' });
console.log(m.type);
console.log(m.toObject());
