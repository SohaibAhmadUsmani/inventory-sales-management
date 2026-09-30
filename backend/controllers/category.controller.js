const Category = require('../models/Category');
const Product = require('../models/Product');
const ActivityLog = require('../models/ActivityLog');

const escapeRegex = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort('name');
    res.json({ success: true, count: categories.length, categories });
  } catch (err) {
    next(err);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const trimmedName = String(name || '').trim();
    const trimmedDescription = description !== undefined ? String(description).trim() : '';

    let category = null;
    if (trimmedName) {
      const existingDeleted = await Category.findOne({
        name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' },
        isActive: false,
      });
      if (existingDeleted) {
        existingDeleted.name = trimmedName;
        existingDeleted.description = trimmedDescription;
        existingDeleted.isActive = true;
        category = await existingDeleted.save();
      }
    }

    if (!category) {
      category = await Category.create({
        name: trimmedName,
        description: trimmedDescription,
      });
    }

    await ActivityLog.create({
      user: req.user.id,
      action: 'Created',
      entity: 'Category',
      entityId: category._id,
      details: `Created category: ${category.name}`,
      ip: req.ip,
      ipAddress: req.ip || '',
    });

    res.status(201).json({ success: true, category });
  } catch (err) {
    next(err);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (description !== undefined) updates.description = String(description).trim();

    const category = await Category.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    await ActivityLog.create({
      user: req.user.id,
      action: 'Updated',
      entity: 'Category',
      entityId: category._id,
      details: `Updated category: ${category.name}`,
      ip: req.ip,
      ipAddress: req.ip || '',
    });

    res.json({ success: true, category });
  } catch (err) {
    next(err);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const activeProducts = await Product.countDocuments({
      category: req.params.id,
      isActive: true,
    });
    if (activeProducts > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category with ${activeProducts} active product(s). Reassign or delete those products first.`,
      });
    }

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    await ActivityLog.create({
      user: req.user.id,
      action: 'Deleted',
      entity: 'Category',
      entityId: category._id,
      details: `Deleted category: ${category.name}`,
      ip: req.ip,
      ipAddress: req.ip || '',
    });

    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
};

