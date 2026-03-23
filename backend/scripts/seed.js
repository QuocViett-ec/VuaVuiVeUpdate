"use strict";

/**
 * Seed script: tạo 1 admin user + toàn bộ sản phẩm thực tế
 * Chạy: node scripts/seed.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User.model");
const Product = require("../models/Product.model");
const Order = require("../models/Order.model");

async function ensureLocalAccount({
  name,
  phone,
  email,
  password,
  role = "user",
  address = "",
}) {
  let account = await User.findOne({ email });

  if (!account && phone) {
    account = await User.findOne({ phone });
  }

  if (!account) {
    await User.create({
      name,
      phone,
      email,
      password,
      address,
      role,
      provider: "local",
      isActive: true,
    });
    account = await User.findOne({ email });
    return { created: true, account };
  }

  account.name = name;
  account.phone = phone;
  account.email = email;
  account.address = address;
  account.role = role;
  account.provider = "local";
  account.isActive = true;
  // Luôn set lại password mẫu để dễ test sau mỗi lần seed
  account.password = password;
  await account.save();
  return { created: false, account };
}

// Hàm helper để tạo imageUrl: chuyển đường dẫn tương đối thành URL tĩnh backend
// Backend phục vụ ../images/ qua /static/ hoặc /images/
function img(relativePath) {
  // Chuẩn hoá dấu gạch chéo, bỏ tiền tố ../ hoặc .\
  return relativePath
    .replace(/\\/g, "/")
    .replace(/^\.\.\//, "")
    .replace(/^\.\//, "");
}

const PRODUCTS = [
  // ══════════════════ RAU CỦ — leaf ══════════════════
  {
    _id: "100",
    name: "Rau muống (500g)",
    category: "veg",
    subCategory: "leaf",
    price: 36000,
    stock: 44,
    unit: "gói",
    imageUrl: img("../images/VEG/leaf/raumuong.jpg"),
    description: "Rau muống tươi ngon (500g)",
    tags: ["rau củ", "xanh lá"],
  },
  {
    _id: "101",
    name: "Cải bẹ xanh (500g)",
    category: "veg",
    subCategory: "leaf",
    price: 18000,
    stock: 26,
    unit: "gói",
    imageUrl: img("../images/VEG/leaf/caibexanh.jpg"),
    description: "Cải bẹ xanh tươi (500g)",
    tags: ["rau củ", "xanh lá"],
  },
  {
    _id: "102",
    name: "Rau mồng tơi (500g)",
    category: "veg",
    subCategory: "leaf",
    price: 16000,
    stock: 36,
    unit: "gói",
    imageUrl: img(
      "../images/VEG/leaf/rau-mong-toi-goi-300g_202506020917306037.jpg",
    ),
    description: "Rau mồng tơi tươi (500g)",
    tags: ["rau củ", "xanh lá"],
  },
  {
    _id: "103",
    name: "Cải Thia (500g)",
    category: "veg",
    subCategory: "leaf",
    price: 18000,
    stock: 26,
    unit: "gói",
    imageUrl: img("../images/VEG/cabbage/cải thìa.jpg"),
    description: "Cải thìa tươi (500g)",
    tags: ["rau củ", "xanh lá"],
  },

  // ── root ──
  {
    _id: "110",
    name: "Cà rốt (500g)",
    category: "veg",
    subCategory: "root",
    price: 15000,
    stock: 15,
    unit: "gói",
    imageUrl: img("../images/VEG/root/Cà Rốt.jpg"),
    description: "Cà rốt tươi (500g)",
    tags: ["rau củ", "củ"],
  },
  {
    _id: "111",
    name: "Khoai tây (1kg)",
    category: "veg",
    subCategory: "root",
    price: 20000,
    stock: 16,
    unit: "gói",
    imageUrl: img("../images/VEG/root/Khoai Tây.jpg"),
    description: "Khoai tây tươi (1kg)",
    tags: ["rau củ", "củ"],
  },
  {
    _id: "112",
    name: "Bí Đỏ (500g)",
    category: "veg",
    subCategory: "root",
    price: 18000,
    stock: 29,
    unit: "gói",
    imageUrl: img("../images/VEG/root/Bí Đỏ.jpg"),
    description: "Bí đỏ tươi (500g)",
    tags: ["rau củ", "củ"],
  },

  // ── fruit-veg ──
  {
    _id: "120",
    name: "Bầu sao (500g)",
    category: "veg",
    subCategory: "fruit-veg",
    price: 12000,
    stock: 23,
    unit: "gói",
    imageUrl: img("../images/VEG/fruit/bausao.jpg"),
    description: "Bầu sao tươi (500g)",
    tags: ["rau củ"],
  },
  {
    _id: "121",
    name: "Bí xanh (1kg)",
    category: "veg",
    subCategory: "fruit-veg",
    price: 25000,
    stock: 22,
    unit: "gói",
    imageUrl: img("../images/VEG/fruit/bi-xanh-trai-202403181357319493.jpg"),
    description: "Bí xanh tươi (1kg)",
    tags: ["rau củ"],
  },
  {
    _id: "122",
    name: "Cà chua bi (500g)",
    category: "veg",
    subCategory: "fruit-veg",
    price: 15000,
    stock: 37,
    unit: "gói",
    imageUrl: img(
      "../images/VEG/fruit/ca-chua-bi-hop-300g_202504140839559740.jpg",
    ),
    description: "Cà chua bi tươi (500g)",
    tags: ["rau củ"],
  },

  // ── mushroom ──
  {
    _id: "130",
    name: "Nấm rơm (200g)",
    category: "veg",
    subCategory: "mushroom",
    price: 20000,
    stock: 56,
    unit: "gói",
    imageUrl: img("../images/VEG/mushroom/namrom.jpg"),
    description: "Nấm rơm tươi (200g)",
    tags: ["rau củ", "nấm"],
  },
  {
    _id: "131",
    name: "Nấm kim châm (200g)",
    category: "veg",
    subCategory: "mushroom",
    price: 18000,
    stock: 46,
    unit: "gói",
    imageUrl: img("../images/VEG/mushroom/namkimcham.jpg"),
    description: "Nấm kim châm tươi (200g)",
    tags: ["rau củ", "nấm"],
  },

  // ── herb ──
  {
    _id: "140",
    name: "Hành Lá (100g)",
    category: "veg",
    subCategory: "herb",
    price: 8000,
    stock: 46,
    unit: "gói",
    imageUrl: img("../images/VEG/herb/hành lá.jpg"),
    description: "Hành lá tươi (100g)",
    tags: ["rau củ", "gia vị"],
  },
  {
    _id: "141",
    name: "Hẹ Lá (100g)",
    category: "veg",
    subCategory: "herb",
    price: 10000,
    stock: 41,
    unit: "gói",
    imageUrl: img("../images/VEG/herb/hẹ lá.jpg"),
    description: "Hẹ lá tươi (100g)",
    tags: ["rau củ", "gia vị"],
  },
  {
    _id: "142",
    name: "Ngò Gai (100g)",
    category: "veg",
    subCategory: "herb",
    price: 4000,
    stock: 14,
    unit: "gói",
    imageUrl: img("../images/VEG/herb/ngò gai.jpg"),
    description: "Ngò gai tươi (100g)",
    tags: ["rau củ", "gia vị"],
  },

  // ── cabbage ──
  {
    _id: "150",
    name: "Cải bẹ dún (1kg)",
    category: "veg",
    subCategory: "cabbage",
    price: 25000,
    stock: 11,
    unit: "gói",
    imageUrl: img("../images/VEG/cabbage/cải bẹ dún.jpg"),
    description: "Cải bẹ dún tươi (1kg)",
    tags: ["rau củ", "cải"],
  },
  {
    _id: "151",
    name: "Cải ngồng (500g)",
    category: "veg",
    subCategory: "cabbage",
    price: 30000,
    stock: 24,
    unit: "gói",
    imageUrl: img("../images/VEG/cabbage/cải ngồng.jpg"),
    description: "Cải ngồng tươi (500g)",
    tags: ["rau củ", "cải"],
  },
  {
    _id: "152",
    name: "Cải ngọt (500g)",
    category: "veg",
    subCategory: "cabbage",
    price: 25000,
    stock: 38,
    unit: "gói",
    imageUrl: img("../images/VEG/cabbage/cải ngọt.jpg"),
    description: "Cải ngọt tươi (500g)",
    tags: ["rau củ", "cải"],
  },
  {
    _id: "153",
    name: "Cải thìa (500g)",
    category: "veg",
    subCategory: "cabbage",
    price: 15000,
    stock: 39,
    unit: "gói",
    imageUrl: img("../images/VEG/cabbage/cải thìa.jpg"),
    description: "Cải thìa tươi (500g)",
    tags: ["rau củ", "cải"],
  },

  // ── organic ──
  {
    _id: "160",
    name: "Xà lách thuỷ tinh thuỷ canh",
    category: "veg",
    subCategory: "organic",
    price: 30000,
    stock: 34,
    unit: "gói",
    imageUrl: img("../images/VEG/organic/xà lách thuỷ canh.jpg"),
    description: "Xà lách thuỷ canh sạch",
    tags: ["rau củ", "hữu cơ"],
  },

  // ── processed-veg ──
  {
    _id: "170",
    name: "Khổ qua sơ chế",
    category: "veg",
    subCategory: "processed",
    price: 30000,
    stock: 59,
    unit: "gói",
    imageUrl: img("../images/VEG/processed/khổ qua sơ chế.jpg"),
    description: "Khổ qua đã sơ chế sạch",
    tags: ["rau củ"],
  },

  // ══════════════════ TRÁI CÂY ══════════════════
  {
    _id: "200",
    name: "Táo Mỹ (1kg)",
    category: "fruit",
    subCategory: "mixed",
    price: 85000,
    stock: 22,
    unit: "kg",
    imageUrl: img("../images/FRUIT/Mixed/Táo.jpg"),
    description: "Táo Mỹ nhập khẩu (1kg)",
    tags: ["trái cây", "táo"],
  },
  {
    _id: "201",
    name: "Chuối Laba (1kg)",
    category: "fruit",
    subCategory: "mixed",
    price: 28000,
    stock: 30,
    unit: "kg",
    imageUrl: img("../images/FRUIT/Mixed/Chuối.jpg"),
    description: "Chuối Laba ngọt (1kg)",
    tags: ["trái cây", "chuối"],
  },
  {
    _id: "202",
    name: "Cam sành (1kg)",
    category: "fruit",
    subCategory: "mixed",
    price: 35000,
    stock: 41,
    unit: "kg",
    imageUrl: img("../images/FRUIT/Mixed/Cam.jpg"),
    description: "Cam sành tươi (1kg)",
    tags: ["trái cây", "cam"],
  },
  {
    _id: "210",
    name: "Giỏ trái cây Mix",
    category: "fruit",
    subCategory: "gift",
    price: 250000,
    stock: 51,
    unit: "giỏ",
    imageUrl: img("../images/FRUIT/gift/mix.jpg"),
    description: "Giỏ trái cây hỗn hợp",
    tags: ["trái cây", "quà tặng"],
  },
  {
    _id: "211",
    name: "Giỏ quà cao cấp",
    category: "fruit",
    subCategory: "gift",
    price: 480000,
    stock: 44,
    unit: "giỏ",
    imageUrl: img("../images/FRUIT/gift/caocap.jpg"),
    description: "Giỏ quà trái cây cao cấp",
    tags: ["trái cây", "quà tặng"],
  },
  {
    _id: "221",
    name: "Cam tươi (1kg)",
    category: "fruit",
    subCategory: "mixed",
    price: 35000,
    stock: 27,
    unit: "kg",
    imageUrl: img("../images/FRUIT/Mixed/Cam.jpg"),
    description: "Cam tươi ngọt (1kg)",
    tags: ["trái cây", "cam"],
  },
  {
    _id: "231",
    name: "Nho nhập khẩu (500g)",
    category: "fruit",
    subCategory: "mixed",
    price: 120000,
    stock: 47,
    unit: "gói",
    imageUrl: img("images/bsthieu/nhonhaukhau.png"),
    description: "Nho nhập khẩu ngọt (500g)",
    tags: ["trái cây", "nho"],
  },
  {
    _id: "240",
    name: "Chuối Laba mùa vụ (1kg)",
    category: "fruit",
    subCategory: "mixed",
    price: 28000,
    stock: 17,
    unit: "kg",
    imageUrl: img("images/bsthieu/chuoixanh.png"),
    description: "Chuối Laba theo mùa (1kg)",
    tags: ["trái cây", "chuối"],
  },

  // ══════════════════ THỊT & CÁ ══════════════════
  {
    _id: "300",
    name: "Thịt heo ba rọi (500g)",
    category: "meat",
    subCategory: "pork",
    price: 70000,
    stock: 35,
    unit: "gói",
    imageUrl: img("../images/MEAT/pork/baroi.jpg"),
    description: "Thịt ba rọi tươi (500g)",
    tags: ["thịt", "heo"],
  },
  {
    _id: "301",
    name: "Sườn non (500g)",
    category: "meat",
    subCategory: "pork",
    price: 85000,
    stock: 36,
    unit: "gói",
    imageUrl: img("../images/MEAT/pork/suon.jpg"),
    description: "Sườn non tươi (500g)",
    tags: ["thịt", "heo"],
  },
  {
    _id: "310",
    name: "Cá basa phi lê (500g)",
    category: "meat",
    subCategory: "fish",
    price: 55000,
    stock: 53,
    unit: "gói",
    imageUrl: img("../images/MEAT/fish/ca-basa-cat-lat_202505260007155939.jpg"),
    description: "Cá basa phi lê (500g)",
    tags: ["cá", "hải sản"],
  },
  {
    _id: "311",
    name: "Cá hồi cắt lát (200g)",
    category: "meat",
    subCategory: "fish",
    price: 95000,
    stock: 48,
    unit: "gói",
    imageUrl: img("../images/MEAT/fish/cahoi.jpg"),
    description: "Cá hồi Na Uy (200g)",
    tags: ["cá", "hải sản"],
  },
  {
    _id: "320",
    name: "Ức gà phi lê (500g)",
    category: "meat",
    subCategory: "poultry",
    price: 60000,
    stock: 13,
    unit: "gói",
    imageUrl: img("../images/MEAT/poultry/ucga.jpg"),
    description: "Ức gà phi lê tươi (500g)",
    tags: ["thịt", "gà"],
  },
  {
    _id: "321",
    name: "Đùi gà ta (1kg)",
    category: "meat",
    subCategory: "poultry",
    price: 85000,
    stock: 24,
    unit: "kg",
    imageUrl: img("../images/MEAT/poultry/dui.jpg"),
    description: "Đùi gà ta tươi (1kg)",
    tags: ["thịt", "gà"],
  },
  {
    _id: "330",
    name: "Bắp bò",
    category: "meat",
    subCategory: "redmeat",
    price: 60000,
    stock: 37,
    unit: "gói",
    imageUrl: img("../images/MEAT/redmeat/bapbo.jpg"),
    description: "Bắp bò tươi ngon",
    tags: ["thịt", "bò"],
  },
  {
    _id: "331",
    name: "Nạm bò",
    category: "meat",
    subCategory: "redmeat",
    price: 85000,
    stock: 10,
    unit: "gói",
    imageUrl: img("../images/MEAT/redmeat/nambo.jpg"),
    description: "Nạm bò tươi ngon",
    tags: ["thịt", "bò"],
  },
  {
    _id: "340",
    name: "Bạch tuộc",
    category: "meat",
    subCategory: "seafood",
    price: 60000,
    stock: 34,
    unit: "gói",
    imageUrl: img("../images/MEAT/seafood/bachtuoc.jpg"),
    description: "Bạch tuộc tươi",
    tags: ["hải sản"],
  },
  {
    _id: "341",
    name: "Râu mực",
    category: "meat",
    subCategory: "seafood",
    price: 85000,
    stock: 39,
    unit: "gói",
    imageUrl: img("../images/MEAT/seafood/râu mực.jpg"),
    description: "Râu mực tươi",
    tags: ["hải sản"],
  },

  // ══════════════════ ĐỒ UỐNG ══════════════════
  {
    _id: "400",
    name: "Nước cam ép Twister (330ml)",
    category: "drink",
    subCategory: "juice",
    price: 12000,
    stock: 11,
    unit: "chai",
    imageUrl: img("../images/DRINK/juice/epcam.jpg"),
    description: "Nước cam ép Twister 330ml",
    tags: ["đồ uống", "nước ép"],
  },
  {
    _id: "401",
    name: "Nước ép táo (350ml)",
    category: "drink",
    subCategory: "juice",
    price: 15000,
    stock: 17,
    unit: "chai",
    imageUrl: img("../images/DRINK/juice/eptao.jpg"),
    description: "Nước ép táo 350ml",
    tags: ["đồ uống", "nước ép"],
  },
  {
    _id: "410",
    name: "Sữa tươi Vinamilk (180ml)",
    category: "drink",
    subCategory: "milk",
    price: 9000,
    stock: 37,
    unit: "hộp",
    imageUrl: img("../images/DRINK/milk/vinamilk.jpg"),
    description: "Sữa tươi Vinamilk 180ml",
    tags: ["đồ uống", "sữa"],
  },
  {
    _id: "411",
    name: "Sữa đậu nành Fami (200ml)",
    category: "drink",
    subCategory: "milk",
    price: 8000,
    stock: 50,
    unit: "hộp",
    imageUrl: img("../images/DRINK/milk/fami.jpg"),
    description: "Sữa đậu nành Fami 200ml",
    tags: ["đồ uống", "sữa"],
  },
  {
    _id: "420",
    name: "Trà ô long Tea Plus (500ml)",
    category: "drink",
    subCategory: "tea",
    price: 10000,
    stock: 53,
    unit: "chai",
    imageUrl: img("../images/DRINK/tea/olong.jpg"),
    description: "Trà ô long Tea Plus 500ml",
    tags: ["đồ uống", "trà"],
  },
  {
    _id: "421",
    name: "Trà chanh C2 (500ml)",
    category: "drink",
    subCategory: "tea",
    price: 9000,
    stock: 37,
    unit: "chai",
    imageUrl: img("../images/DRINK/tea/c2.jpg"),
    description: "Trà chanh C2 500ml",
    tags: ["đồ uống", "trà"],
  },
  {
    _id: "430",
    name: "Soda chanh 7 Up (320ml)",
    category: "drink",
    subCategory: "can",
    price: 10000,
    stock: 50,
    unit: "lon",
    imageUrl: img("../images/DRINK/can/7upsodachanh.jpg"),
    description: "7Up soda chanh 320ml",
    tags: ["đồ uống", "nước ngọt"],
  },
  {
    _id: "431",
    name: "Nước ngọt Fanta hương dâu lon (320ml)",
    category: "drink",
    subCategory: "can",
    price: 9000,
    stock: 39,
    unit: "lon",
    imageUrl: img("../images/DRINK/can/fantadau.jpg"),
    description: "Fanta hương dâu 320ml",
    tags: ["đồ uống", "nước ngọt"],
  },
  {
    _id: "440",
    name: "Cà phê phin Phương Vy 500g",
    category: "drink",
    subCategory: "coffee",
    price: 10000,
    stock: 58,
    unit: "gói",
    imageUrl: img("../images/DRINK/coffee/caphephin.jpg"),
    description: "Cà phê phin đậm truyền thống 500g",
    tags: ["đồ uống", "cà phê"],
  },
  {
    _id: "441",
    name: "Cà phê Trung Nguyên S 100g",
    category: "drink",
    subCategory: "coffee",
    price: 9000,
    stock: 39,
    unit: "gói",
    imageUrl: img("../images/DRINK/coffee/caphetrungnguyen.jpg"),
    description: "Cà phê Trung Nguyên S 100g",
    tags: ["đồ uống", "cà phê"],
  },

  // ══════════════════ HÀNG KHÔ ══════════════════
  {
    _id: "500",
    name: "Gạo ST25 (1kg)",
    category: "dry",
    subCategory: "rice",
    price: 38000,
    stock: 29,
    unit: "kg",
    imageUrl: img("../images/DRY/rice/st25.jpg"),
    description: "Gạo ST25 thơm ngon (1kg)",
    tags: ["hàng khô", "gạo"],
  },
  {
    _id: "501",
    name: "Gạo thơm Jasmine (1kg)",
    category: "dry",
    subCategory: "rice",
    price: 32000,
    stock: 30,
    unit: "kg",
    imageUrl: img("../images/DRY/rice/gaothom.jpg"),
    description: "Gạo thơm Jasmine (1kg)",
    tags: ["hàng khô", "gạo"],
  },
  {
    _id: "510",
    name: "Mì Hảo Hảo (5 gói)",
    category: "dry",
    subCategory: "noodle",
    price: 24000,
    stock: 55,
    unit: "gói",
    imageUrl: img("../images/DRY/noodle/haohao.jpg"),
    description: "Mì Hảo Hảo tôm chua cay (5 gói)",
    tags: ["hàng khô", "mì"],
  },
  {
    _id: "511",
    name: "Bún khô (500g)",
    category: "dry",
    subCategory: "noodle",
    price: 22000,
    stock: 54,
    unit: "gói",
    imageUrl: img("../images/DRY/noodle/bunkho.jpg"),
    description: "Bún khô (500g)",
    tags: ["hàng khô", "bún"],
  },
  {
    _id: "520",
    name: "Đậu xanh (500g)",
    category: "dry",
    subCategory: "beans",
    price: 26000,
    stock: 32,
    unit: "gói",
    imageUrl: img("../images/DRY/beans/dauxanh.jpg"),
    description: "Đậu xanh (500g)",
    tags: ["hàng khô", "đậu"],
  },
  {
    _id: "521",
    name: "Đậu đỏ (500g)",
    category: "dry",
    subCategory: "beans",
    price: 25000,
    stock: 48,
    unit: "gói",
    imageUrl: img("../images/DRY/beans/daudo.jpg"),
    description: "Đậu đỏ (500g)",
    tags: ["hàng khô", "đậu"],
  },
  {
    _id: "530",
    name: "Bột phô mai StFood 100g",
    category: "dry",
    subCategory: "flour",
    price: 26000,
    stock: 50,
    unit: "gói",
    imageUrl: img("../images/DRY/flour/bột phô mai.jpg"),
    description: "Bột phô mai StFood 100g",
    tags: ["hàng khô", "bột"],
  },
  {
    _id: "531",
    name: "Bột bánh rán Ajinomoto 200g",
    category: "dry",
    subCategory: "flour",
    price: 25000,
    stock: 58,
    unit: "gói",
    imageUrl: img("../images/DRY/flour/bột bánh rán doraemon.jpg"),
    description: "Bột bánh rán truyền thống 200g",
    tags: ["hàng khô", "bột"],
  },
  {
    _id: "540",
    name: "Rong biển rắc giòn gia vị",
    category: "dry",
    subCategory: "seaweed",
    price: 26000,
    stock: 23,
    unit: "gói",
    imageUrl: img("../images/DRY/seaweed/rong biển giòn.jpg"),
    description: "Rong biển rắc giòn gia vị",
    tags: ["hàng khô", "rong biển"],
  },
  {
    _id: "541",
    name: "Rong biển nướng chà bông",
    category: "dry",
    subCategory: "seaweed",
    price: 25000,
    stock: 52,
    unit: "gói",
    imageUrl: img("../images/DRY/seaweed/rong biển.jpg"),
    description: "Rong biển nướng giòn chà bông cá hồi",
    tags: ["hàng khô", "rong biển"],
  },
  {
    _id: "550",
    name: "Pate thịt bò Vissan",
    category: "dry",
    subCategory: "canned",
    price: 25000,
    stock: 31,
    unit: "hộp",
    imageUrl: img("../images/DRY/canned/vissan bò 2 lát.png"),
    description: "Pate thịt bò Vissan",
    tags: ["hàng khô", "đồ hộp"],
  },
  {
    _id: "551",
    name: "Thịt heo hai lát Vissan (150g)",
    category: "dry",
    subCategory: "canned",
    price: 35000,
    stock: 16,
    unit: "hộp",
    imageUrl: img("../images/DRY/canned/vissan heo 2 lát.png"),
    description: "Thịt heo hai lát Vissan 150g",
    tags: ["hàng khô", "đồ hộp"],
  },

  // ══════════════════ GIA VỊ ══════════════════
  {
    _id: "600",
    name: "Nước mắm Nam Ngư (500ml)",
    category: "spice",
    subCategory: "sauce",
    price: 25000,
    stock: 38,
    unit: "chai",
    imageUrl: img("../images/SPICE/Sauce/nuocmam.jpg"),
    description: "Nước mắm Nam Ngư 500ml",
    tags: ["gia vị", "nước mắm"],
  },
  {
    _id: "601",
    name: "Nước tương Maggi (500ml)",
    category: "spice",
    subCategory: "sauce",
    price: 23000,
    stock: 20,
    unit: "chai",
    imageUrl: img("../images/SPICE/Sauce/nuoctuong.jpg"),
    description: "Nước tương Maggi 500ml",
    tags: ["gia vị", "nước tương"],
  },
  {
    _id: "610",
    name: "Dầu ăn Neptune (1L)",
    category: "spice",
    subCategory: "oil",
    price: 55000,
    stock: 28,
    unit: "chai",
    imageUrl: img(
      "../images/SPICE/Oil/226995-thumb-moi_202411071422115102.jpg",
    ),
    description: "Dầu ăn Neptune 1L",
    tags: ["gia vị", "dầu ăn"],
  },
  {
    _id: "620",
    name: "Muối i-ốt (200g)",
    category: "spice",
    subCategory: "powder",
    price: 6000,
    stock: 17,
    unit: "gói",
    imageUrl: img("../images/SPICE/Powder/muoi.jpg"),
    description: "Muối i-ốt (200g)",
    tags: ["gia vị", "muối"],
  },
  {
    _id: "621",
    name: "Bột ngọt Ajinomoto (200g)",
    category: "spice",
    subCategory: "powder",
    price: 12000,
    stock: 13,
    unit: "gói",
    imageUrl: img("../images/SPICE/Powder/botngot.jpg"),
    description: "Bột ngọt Ajinomoto 200g",
    tags: ["gia vị", "bột ngọt"],
  },
  {
    _id: "640",
    name: "Gia vị nướng BBQ (50g)",
    category: "spice",
    subCategory: "other",
    price: 32000,
    stock: 13,
    unit: "gói",
    imageUrl: img("images/bsthieu/thitnuong.png"),
    description: "Gia vị nướng BBQ 50g",
    tags: ["gia vị"],
  },
  {
    _id: "641",
    name: "Gia vị lẩu thái (50g)",
    category: "spice",
    subCategory: "other",
    price: 35000,
    stock: 26,
    unit: "gói",
    imageUrl: img("images/bsthieu/lauthai.png"),
    description: "Gia vị lẩu thái 50g",
    tags: ["gia vị"],
  },

  // ══════════════════ GIA DỤNG ══════════════════
  {
    _id: "700",
    name: "Túi đựng rác đen",
    category: "household",
    subCategory: "bags",
    price: 20000,
    stock: 43,
    unit: "cuộn",
    imageUrl: img("../images/HOUSEHOLD/bags/tuidungracden.jpg"),
    description: "Túi đựng rác đen",
    tags: ["gia dụng"],
  },
  {
    _id: "701",
    name: "Túi đựng rác màu",
    category: "household",
    subCategory: "bags",
    price: 22000,
    stock: 44,
    unit: "cuộn",
    imageUrl: img("../images/HOUSEHOLD/bags/túi đựng rác màu.jpg"),
    description: "Túi đựng rác màu",
    tags: ["gia dụng"],
  },
  {
    _id: "710",
    name: "Nước rửa chén Sunlight gói",
    category: "household",
    subCategory: "cleaning",
    price: 10000,
    stock: 54,
    unit: "gói",
    imageUrl: img("../images/HOUSEHOLD/cleaning/sunlight gói.jpg"),
    description: "Nước rửa chén Sunlight gói",
    tags: ["gia dụng", "vệ sinh"],
  },
  {
    _id: "711",
    name: "Nước rửa chén Sunlight",
    category: "household",
    subCategory: "cleaning",
    price: 35000,
    stock: 27,
    unit: "chai",
    imageUrl: img("../images/HOUSEHOLD/cleaning/sunlight.jpg"),
    description: "Nước rửa chén Sunlight chai",
    tags: ["gia dụng", "vệ sinh"],
  },
  {
    _id: "720",
    name: "Dao bào",
    category: "household",
    subCategory: "kitchenware",
    price: 40000,
    stock: 27,
    unit: "cái",
    imageUrl: img("../images/HOUSEHOLD/kitchenware/dao bào.jpg"),
    description: "Dao bào nhựa",
    tags: ["gia dụng", "bếp"],
  },
  {
    _id: "721",
    name: "Hộp đựng thực phẩm",
    category: "household",
    subCategory: "kitchenware",
    price: 50000,
    stock: 33,
    unit: "cái",
    imageUrl: img("../images/HOUSEHOLD/kitchenware/hộp đựng thực phẩm.jpg"),
    description: "Hộp đựng thực phẩm",
    tags: ["gia dụng", "bếp"],
  },
  {
    _id: "723",
    name: "Bộ hũ gia vị (3 chiếc)",
    category: "household",
    subCategory: "kitchenware",
    price: 49000,
    stock: 59,
    unit: "bộ",
    imageUrl: img("images/bsthieu/lo.png"),
    description: "Bộ hũ gia vị 3 chiếc",
    tags: ["gia dụng", "bếp"],
  },
  {
    _id: "730",
    name: "Bột giặt Aba",
    category: "household",
    subCategory: "laundry",
    price: 65000,
    stock: 56,
    unit: "túi",
    imageUrl: img("../images/HOUSEHOLD/laundry/aba.jpg"),
    description: "Bột giặt Aba",
    tags: ["gia dụng", "giặt giũ"],
  },
  {
    _id: "731",
    name: "Bột giặt Omo",
    category: "household",
    subCategory: "laundry",
    price: 70000,
    stock: 53,
    unit: "túi",
    imageUrl: img("../images/HOUSEHOLD/laundry/omo.jpg"),
    description: "Bột giặt Omo",
    tags: ["gia dụng", "giặt giũ"],
  },
  {
    _id: "740",
    name: "Khăn tắm",
    category: "household",
    subCategory: "paper",
    price: 80000,
    stock: 59,
    unit: "cái",
    imageUrl: img("../images/HOUSEHOLD/paper/khăn tắm.jpg"),
    description: "Khăn tắm bông mềm",
    tags: ["gia dụng"],
  },
  {
    _id: "741",
    name: "Giấy vệ sinh Puri",
    category: "household",
    subCategory: "paper",
    price: 30000,
    stock: 41,
    unit: "cuộn",
    imageUrl: img("../images/HOUSEHOLD/paper/puri.jpg"),
    description: "Giấy vệ sinh Puri",
    tags: ["gia dụng"],
  },
  {
    _id: "750",
    name: "Kem đánh răng Closeup",
    category: "household",
    subCategory: "personal",
    price: 32000,
    stock: 35,
    unit: "tuýp",
    imageUrl: img("../images/HOUSEHOLD/personal/closeup.jpg"),
    description: "Kem đánh răng Closeup",
    tags: ["gia dụng", "chăm sóc cá nhân"],
  },
  {
    _id: "751",
    name: "Kem dưỡng da Nivea",
    category: "household",
    subCategory: "personal",
    price: 95000,
    stock: 12,
    unit: "hộp",
    imageUrl: img("../images/HOUSEHOLD/personal/nivea.jpg"),
    description: "Kem dưỡng da Nivea",
    tags: ["gia dụng", "chăm sóc cá nhân"],
  },
  {
    _id: "752",
    name: "Dầu gội Sunsilk",
    category: "household",
    subCategory: "personal",
    price: 75000,
    stock: 57,
    unit: "chai",
    imageUrl: img("../images/HOUSEHOLD/personal/sunsilk.jpg"),
    description: "Dầu gội Sunsilk",
    tags: ["gia dụng", "chăm sóc cá nhân"],
  },

  // ══════════════════ BÁNH KẸO ══════════════════
  {
    _id: "800",
    name: "Bánh Oreo (133g)",
    category: "sweet",
    subCategory: "snack",
    price: 15000,
    stock: 48,
    unit: "gói",
    imageUrl: img("../images/SWEET/SNACK/oreo.jpg"),
    description: "Bánh Oreo kem vani (133g)",
    tags: ["bánh kẹo", "snack"],
  },
  {
    _id: "801",
    name: "Bánh gạo One One (100g)",
    category: "sweet",
    subCategory: "snack",
    price: 18000,
    stock: 21,
    unit: "gói",
    imageUrl: img("../images/SWEET/SNACK/oneone.jpg"),
    description: "Bánh gạo One One (100g)",
    tags: ["bánh kẹo", "snack"],
  },
  {
    _id: "810",
    name: "Socola Snickers (40g)",
    category: "sweet",
    subCategory: "chocolate",
    price: 25000,
    stock: 13,
    unit: "thanh",
    imageUrl: img("../images/SWEET/CHOCOLATE/snickers.jpg"),
    description: "Socola kẹo đậu phộng Snickers",
    tags: ["bánh kẹo", "socola"],
  },
  {
    _id: "820",
    name: "Kẹo Alpenliebe (120g)",
    category: "sweet",
    subCategory: "candy",
    price: 18000,
    stock: 37,
    unit: "gói",
    imageUrl: img("../images/SWEET/CANDY/alpenliebe.jpg"),
    description: "Kẹo Alpenliebe dâu kem (120g)",
    tags: ["bánh kẹo", "kẹo"],
  },
  {
    _id: "821",
    name: "Kẹo bạc hà Mentos (38g)",
    category: "sweet",
    subCategory: "candy",
    price: 15000,
    stock: 55,
    unit: "gói",
    imageUrl: img("../images/SWEET/CANDY/mentos.jpg"),
    description: "Kẹo bạc hà Mentos (38g)",
    tags: ["bánh kẹo", "kẹo"],
  },
  {
    _id: "830",
    name: "Ngũ cốc Granola",
    category: "sweet",
    subCategory: "cereal",
    price: 95000,
    stock: 29,
    unit: "gói",
    imageUrl: img("../images/SWEET/cereal/ngũ cốc granola.jpg"),
    description: "Ngũ cốc Granola dinh dưỡng",
    tags: ["bánh kẹo", "ngũ cốc"],
  },
  {
    _id: "840",
    name: "Chuối sấy",
    category: "sweet",
    subCategory: "dried",
    price: 45000,
    stock: 54,
    unit: "gói",
    imageUrl: img("../images/SWEET/dried/chuối sấy.jpg"),
    description: "Chuối sấy giòn ngọt",
    tags: ["bánh kẹo", "hoa quả sấy"],
  },
  {
    _id: "841",
    name: "Mít sấy",
    category: "sweet",
    subCategory: "dried",
    price: 50000,
    stock: 11,
    unit: "gói",
    imageUrl: img("../images/SWEET/dried/mít sấy.jpg"),
    description: "Mít sấy giòn",
    tags: ["bánh kẹo", "hoa quả sấy"],
  },
  {
    _id: "842",
    name: "Xoài sấy",
    category: "sweet",
    subCategory: "dried",
    price: 60000,
    stock: 10,
    unit: "gói",
    imageUrl: img("../images/SWEET/dried/xoài sấy.jpg"),
    description: "Xoài sấy dẻo",
    tags: ["bánh kẹo", "hoa quả sấy"],
  },
  {
    _id: "561",
    name: "Hạt hạnh nhân (100g)",
    category: "sweet",
    subCategory: "nuts",
    price: 65000,
    stock: 31,
    unit: "gói",
    imageUrl: img("images/bsthieu/hachnhan.png"),
    description: "Hạt hạnh nhân rang (100g)",
    tags: ["bánh kẹo", "hạt"],
  },
];

const DEMO_CUSTOMERS = [
  {
    name: "Nguyen Minh Chau",
    phone: "0900000001",
    email: "chau.demo@vuavuive.vn",
    password: "User@123",
    address: "12 Nguyen Van Cu, Quan 5, TP.HCM",
  },
  {
    name: "Tran Quoc Bao",
    phone: "0900000002",
    email: "bao.demo@vuavuive.vn",
    password: "User@123",
    address: "81 Le Van Sy, Quan 3, TP.HCM",
  },
  {
    name: "Le Hoai Thu",
    phone: "0900000003",
    email: "thu.demo@vuavuive.vn",
    password: "User@123",
    address: "24 Phan Xich Long, Phu Nhuan, TP.HCM",
  },
  {
    name: "Pham Gia Han",
    phone: "0900000004",
    email: "han.demo@vuavuive.vn",
    password: "User@123",
    address: "56 Cach Mang Thang 8, Quan 10, TP.HCM",
  },
  {
    name: "Vo Duc Khang",
    phone: "0900000005",
    email: "khang.demo@vuavuive.vn",
    password: "User@123",
    address: "102 Quang Trung, Go Vap, TP.HCM",
  },
  {
    name: "Bui Ngoc Anh",
    phone: "0900000006",
    email: "anh.demo@vuavuive.vn",
    password: "User@123",
    address: "35 Xa Lo Ha Noi, Thu Duc, TP.HCM",
  },
  {
    name: "Dang Tuan Kiet",
    phone: "0900000007",
    email: "kiet.demo@vuavuive.vn",
    password: "User@123",
    address: "88 Nguyen Huu Tho, Nha Be, TP.HCM",
  },
  {
    name: "Hoang My Linh",
    phone: "0900000008",
    email: "linh.demo@vuavuive.vn",
    password: "User@123",
    address: "17 Ly Thuong Kiet, Tan Binh, TP.HCM",
  },
  {
    name: "Nguyen Van A",
    phone: "0900000009",
    email: "vana.demo@vuavuive.vn",
    password: "User@123",
    address: "22 Pham Van Dong, Binh Thanh, TP.HCM",
  },
  {
    name: "Le Thi B",
    phone: "0900000010",
    email: "thib.demo@vuavuive.vn",
    password: "User@123",
    address: "15 Nguyen Dinh Chieu, Quan 3, TP.HCM",
  },
  {
    name: "Tran Van C",
    phone: "0900000011",
    email: "vanc.demo@vuavuive.vn",
    password: "User@123",
    address: "99 Huynh Tan Phat, Quan 7, TP.HCM",
  },
  {
    name: "Phan Thi D",
    phone: "0900000012",
    email: "thid.demo@vuavuive.vn",
    password: "User@123",
    address: "12R Truong Chinh, Tan Binh, TP.HCM",
  },
  {
    name: "Doan Van E",
    phone: "0900000013",
    email: "vane.demo@vuavuive.vn",
    password: "User@123",
    address: "7 Nguyen Hue, Quan 1, TP.HCM",
  },
  {
    name: "Vo Thi F",
    phone: "0900000014",
    email: "thif.demo@vuavuive.vn",
    password: "User@123",
    address: "123 Ba Thang Hai, Quan 10, TP.HCM",
  },
  {
    name: "Bui Van G",
    phone: "0900000015",
    email: "vang.demo@vuavuive.vn",
    password: "User@123",
    address: "45 Le Duan, Quan 1, TP.HCM",
  },
  {
    name: "Hoang Thi H",
    phone: "0900000016",
    email: "thih.demo@vuavuive.vn",
    password: "User@123",
    address: "67 Pasteur, Quan 3, TP.HCM",
  },
  {
    name: "Truong Van I",
    phone: "0900000017",
    email: "vani.demo@vuavuive.vn",
    password: "User@123",
    address: "89 Dien Bien Phu, Binh Thanh, TP.HCM",
  },
  {
    name: "Lam Thi K",
    phone: "0900000018",
    email: "thik.demo@vuavuive.vn",
    password: "User@123",
    address: "2 Vo Van Ngan, Thu Duc, TP.HCM",
  },
];

const DELIVERY_SLOTS = ["09:00-11:00", "13:00-15:00", "18:00-20:00"];
const PAYMENT_METHODS = ["cod", "vnpay", "momo"];
const SEASONAL_MULTIPLIER = {
  0: 1.15,
  1: 0.92,
  2: 1.0,
  3: 1.08,
  4: 1.16,
  5: 1.22,
  6: 1.35,
  7: 1.32,
  8: 1.18,
  9: 1.26,
  10: 1.42,
  11: 1.55,
};

function monthCampaignNote(monthIndex) {
  const notes = [
    "Tet sale",
    "Nhu cau sau Tet",
    "Mua sam cuoi tuan",
    "Thang rau sach",
    "Khuyen mai combo gia dinh",
    "Mua he trai cay",
    "Mua mua giao nhanh",
    "Back to school",
    "Trung thu",
    "Mua sam cuoi nam",
    "11.11 sale",
    "Noel va Tet Duong lich",
  ];
  return notes[monthIndex] || "";
}

function pickProductsForOrder(allProducts, dayOffset, orderIndex) {
  const itemCount = 1 + ((dayOffset + orderIndex) % 4);
  const start = (dayOffset * 7 + orderIndex * 11) % allProducts.length;
  const items = [];

  for (let i = 0; i < itemCount; i++) {
    const product = allProducts[(start + i * 3) % allProducts.length];
    const quantity = 1 + ((dayOffset + orderIndex + i) % 3);
    items.push({
      productId: product._id,
      productName: product.name,
      quantity,
      price: product.price,
      subtotal: product.price * quantity,
    });
  }

  return items;
}

function computeShippingFee(address, subtotal) {
  if (subtotal >= 300000) return 0;
  if (/thu duc|go vap|tan binh|phu nhuan|quan/i.test(address)) return 15000;
  if (/nha be|binh chanh|hoc mon/i.test(address)) return 25000;
  return 20000;
}

function decideOrderStatus(dayOffset, orderIndex) {
  if (dayOffset <= 1) {
    return ["pending", "confirmed", "shipping"][(dayOffset + orderIndex) % 3];
  }
  if (dayOffset <= 5) {
    return ["confirmed", "shipping", "delivered"][(dayOffset + orderIndex) % 3];
  }
  if ((dayOffset + orderIndex) % 11 === 0) return "cancelled";
  return "delivered";
}

function buildDemoOrders(users, products) {
  const now = new Date();
  const orders = [];

  for (let dayOffset = 210; dayOffset >= 0; dayOffset--) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(now.getDate() - dayOffset);

    const monthFactor = SEASONAL_MULTIPLIER[day.getMonth()] ?? 1;
    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
    const weekendFactor = isWeekend ? 0.85 : 1.1;
    const recentFactor = dayOffset <= 7 ? 1.6 : dayOffset <= 30 ? 1.25 : 1;
    const rawVolume = monthFactor * weekendFactor * recentFactor;
    const orderCount = Math.max(
      0,
      Math.min(5, Math.round(rawVolume + ((dayOffset * 17) % 4) - 1)),
    );

    for (let orderIndex = 0; orderIndex < orderCount; orderIndex++) {
      const user = users[(dayOffset + orderIndex * 2) % users.length];
      const items = pickProductsForOrder(products, dayOffset, orderIndex);
      const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
      const shippingFee = computeShippingFee(user.address || "", subtotal);
      const voucherCode =
        subtotal > 260000 && (dayOffset + orderIndex) % 5 === 0
          ? "GIAM10"
          : shippingFee > 0 && (dayOffset + orderIndex) % 7 === 0
            ? "FREESHIP"
            : "";
      const discount =
        voucherCode === "GIAM10"
          ? Math.round(subtotal * 0.1)
          : voucherCode === "FREESHIP"
            ? shippingFee
            : 0;
      const totalAmount = Math.max(0, subtotal + shippingFee - discount);
      const status = decideOrderStatus(dayOffset, orderIndex);
      const paymentMethod =
        PAYMENT_METHODS[(dayOffset + orderIndex) % PAYMENT_METHODS.length];
      const paymentStatus =
        status === "cancelled"
          ? "pending"
          : paymentMethod === "cod" && dayOffset <= 2
            ? "pending"
            : "paid";
      const createdAt = new Date(day);
      createdAt.setHours(8 + ((dayOffset + orderIndex * 3) % 12));
      createdAt.setMinutes((dayOffset * 13 + orderIndex * 19) % 60);
      createdAt.setSeconds((dayOffset * 29 + orderIndex * 7) % 60);

      const updatedAt = new Date(createdAt);
      updatedAt.setHours(
        createdAt.getHours() + (status === "delivered" ? 18 : 4),
      );

      orders.push({
        userId: user._id,
        items,
        delivery: {
          name: user.name,
          phone: user.phone,
          address: user.address || "TP.HCM",
          slot: DELIVERY_SLOTS[
            (dayOffset + orderIndex) % DELIVERY_SLOTS.length
          ],
        },
        payment: {
          method: paymentMethod,
          status: paymentStatus,
        },
        voucherCode,
        shippingFee,
        discount,
        subtotal,
        totalAmount,
        status,
        note: monthCampaignNote(createdAt.getMonth()),
        createdAt,
        updatedAt,
      });
    }
  }

  return orders;
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(" MongoDB kết nối thành công");

    // Xoá sản phẩm cũ, giữ lại users
    await Order.deleteMany({});
    await Product.deleteMany({});
    console.log("  Đã xóa sản phẩm cũ");

    const adminSeed = {
      name: "Admin VuaVuiVe",
      phone: "0901234567",
      email: "admin@vuavuive.vn",
      password: "Admin@123",
      role: "admin",
    };

    const userSeed = {
      name: "User Test VuaVuiVe",
      phone: "0912345678",
      email: "user.test@vuavuive.vn",
      password: "User@123",
      role: "user",
      address: "45 Tran Hung Dao, Quan 1, TP.HCM",
    };

    const staffSeed = {
      name: "Nhân Viên VuaVuiVe",
      phone: "0923456789",
      email: "staff@vuavuive.vn",
      password: "Staff@123",
      role: "staff",
      address: "12 Nguyen Hue, Quan 1, TP.HCM",
    };

    const auditSeed = {
      name: "Kiểm Toán VuaVuiVe",
      phone: "0934567890",
      email: "audit@vuavuive.vn",
      password: "Audit@123",
      role: "audit",
      address: "88 Le Loi, Quan 1, TP.HCM",
    };

    const adminResult = await ensureLocalAccount(adminSeed);
    const staffResult = await ensureLocalAccount(staffSeed);
    const auditResult = await ensureLocalAccount(auditSeed);
    const userResult = await ensureLocalAccount(userSeed);
    const demoResults = await Promise.all(
      DEMO_CUSTOMERS.map((customer) => ensureLocalAccount(customer)),
    );
    const seededUsers = [
      userResult.account,
      ...demoResults.map((item) => item.account),
    ].filter(Boolean);

    console.log(
      adminResult.created
        ? " Admin tạo mới: admin@vuavuive.vn / Admin@123"
        : " Admin đã được cập nhật lại thông tin đăng nhập mẫu",
    );
    console.log(
      staffResult.created
        ? " Staff tạo mới: staff@vuavuive.vn / Staff@123"
        : " Staff đã được cập nhật lại thông tin đăng nhập mẫu",
    );
    console.log(
      auditResult.created
        ? " Audit tạo mới: audit@vuavuive.vn / Audit@123"
        : " Audit đã được cập nhật lại thông tin đăng nhập mẫu",
    );
    console.log(
      userResult.created
        ? " User test tạo mới: user.test@vuavuive.vn / User@123"
        : " User test đã được cập nhật lại thông tin đăng nhập mẫu",
    );

    // Xóa _id string trước khi insert để MongoDB tự tạo ObjectId
    // (Lưu externalId để tra cứu)
    let count = 0;
    for (const p of PRODUCTS) {
      const { _id, ...data } = p;
      try {
        await Product.create({ ...data, externalId: _id });
        count++;
      } catch (e) {
        console.warn(`  Bỏ qua "${p.name}": ${e.message}`);
      }
    }
    console.log(` Đã tạo ${count}/${PRODUCTS.length} sản phẩm`);
    console.log("\n Seed hoàn tất!");
  } catch (err) {
    console.error(" Lỗi khi seed:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
