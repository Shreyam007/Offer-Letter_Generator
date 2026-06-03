import mongoose from 'mongoose';

const templateSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    subject: { type: String, required: true },
    body: { type: String, required: true }, // e.g. "Dear {{Name}}, we offer you the role of {{Role}}..."
    style: { type: String, enum: ['Modern', 'Classic', 'Minimal'], default: 'Modern' },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true }
  },
  { timestamps: true }
);

templateSchema.index({ companyId: 1 });

const Template = mongoose.model('Template', templateSchema);
export default Template;
