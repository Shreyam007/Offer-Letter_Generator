import mongoose from 'mongoose';

const companySchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    tagline: { type: String, default: '' },
    logo: { type: String, default: '' }, // SVG text or base64 image data
    address: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    website: { type: String, default: '' },
    smtp: {
      host: { type: String, default: '' },
      port: { type: Number, default: 587 },
      secure: { type: Boolean, default: false },
      user: { type: String, default: '' },
      pass: { type: String, default: '' }
    }
  },
  { timestamps: true }
);

const Company = mongoose.model('Company', companySchema);
export default Company;
