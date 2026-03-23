"use strict";

const express = require("express");
const router = express.Router();

function ing(name) {
  return { name, qty: "1", unit: "phần" };
}

const RECIPES = [
  {
    id: "1",
    name: "Canh bí đỏ",
    image: "/images/recipes/canh-bi-do.jpg",
    ingredients: [
      ing("Bí Đỏ"),
      ing("Thịt heo ba rọi"),
      ing("Hành Lá"),
      ing("Nước mắm Nam Ngư"),
    ],
  },
  {
    id: "2",
    name: "Cá kho tộ",
    image: "/images/recipes/ca-kho-to.jpg",
    ingredients: [
      ing("Cá basa phi lê"),
      ing("Nước mắm Nam Ngư"),
      ing("Bột ngọt Ajinomoto"),
    ],
  },
  {
    id: "3",
    name: "Rau muống xào tỏi",
    image: "/images/recipes/rau-muong-xao.jpg",
    ingredients: [ing("Rau muống"), ing("Dầu ăn Neptune"), ing("Muối i-ốt")],
  },
  {
    id: "4",
    name: "Canh chua cá basa",
    image: "/images/recipes/canh-chua-ca-basa.jpg",
    ingredients: [
      ing("Cá basa phi lê"),
      ing("Cà chua bi"),
      ing("Ngò Gai"),
      ing("Muối i-ốt"),
      ing("Nước mắm Nam Ngư"),
    ],
  },
  {
    id: "5",
    name: "Canh rau mồng tơi",
    image: "/images/recipes/canh-rau-mong-toi.jpg",
    ingredients: [ing("Rau mồng tơi"), ing("Hành Lá"), ing("Muối i-ốt")],
  },
  {
    id: "6",
    name: "Khoai tây xào thịt heo",
    image: "/images/recipes/khoai-tay-xao-thit-heo.jpg",
    ingredients: [
      ing("Khoai tây"),
      ing("Thịt heo ba rọi"),
      ing("Hành Lá"),
      ing("Dầu ăn Neptune"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "7",
    name: "Cà rốt xào nấm rơm",
    image: "/images/recipes/ca-rot-xao-nam-rom.jpg",
    ingredients: [
      ing("Cà rốt"),
      ing("Nấm rơm"),
      ing("Dầu ăn Neptune"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "8",
    name: "Cải ngọt xào",
    image: "/images/recipes/cai-ngot-xao.jpg",
    ingredients: [
      ing("Cải ngọt"),
      ing("Nước tương Maggi"),
      ing("Dầu ăn Neptune"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "9",
    name: "Canh bí xanh thịt heo",
    image: "/images/recipes/canh-bi-xanh-thit-heo.jpg",
    ingredients: [
      ing("Bí xanh"),
      ing("Thịt heo ba rọi"),
      ing("Hành Lá"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "11",
    name: "Ức gà áp chảo",
    image: "/images/recipes/uc-ga-ap-chao.jpg",
    ingredients: [ing("Ức gà phi lê"), ing("Muối i-ốt"), ing("Dầu ăn Neptune")],
  },
  {
    id: "12",
    name: "Nấm kim châm xào ức gà",
    image: "/images/recipes/nam-kim-cham-xao-uc-ga.jpg",
    ingredients: [
      ing("Nấm kim châm"),
      ing("Ức gà phi lê"),
      ing("Dầu ăn Neptune"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "13",
    name: "Đùi gà chiên nước mắm",
    image: "/images/recipes/dui-ga-chien-nuoc-mam.jpg",
    ingredients: [
      ing("Đùi gà ta"),
      ing("Nước mắm Nam Ngư"),
      ing("Dầu ăn Neptune"),
    ],
  },
  {
    id: "14",
    name: "Cá hồi áp chảo",
    image: "/images/recipes/ca-hoi-ap-chao.jpg",
    ingredients: [
      ing("Cá hồi cắt lát"),
      ing("Muối i-ốt"),
      ing("Dầu ăn Neptune"),
    ],
  },
  {
    id: "15",
    name: "Cá basa chiên giòn",
    image: "/images/recipes/ca-basa-chien-gion.jpg",
    ingredients: [
      ing("Cá basa phi lê"),
      ing("Bột bánh rán Ajinomoto"),
      ing("Dầu ăn Neptune"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "16",
    name: "Bắp bò hầm cà rốt",
    image: "/images/recipes/bop-bo-ham-ca-rot.jpg",
    ingredients: [
      ing("Bắp bò"),
      ing("Cà rốt"),
      ing("Hành Lá"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "17",
    name: "Nạm bò xào cải ngồng",
    image: "/images/recipes/nam-bo-xao-cai-ngong.jpg",
    ingredients: [
      ing("Nạm bò"),
      ing("Cải ngồng"),
      ing("Dầu ăn Neptune"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "18",
    name: "Cải thìa xào nấm",
    image: "/images/recipes/cai-thia-xao-nam.jpg",
    ingredients: [
      ing("Cải thìa"),
      ing("Nấm rơm"),
      ing("Dầu ăn Neptune"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "20",
    name: "Mực xào hành hẹ",
    image: "/images/recipes/muc-xao-hanh-he.jpg",
    ingredients: [
      ing("Râu mực"),
      ing("Hành Lá"),
      ing("Hẹ Lá"),
      ing("Dầu ăn Neptune"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "21",
    name: "Salad xà lách cà chua",
    image: "/images/recipes/salad-xa-lach-ca-chua.jpg",
    ingredients: [
      ing("Xà lách thuỷ tinh thuỷ canh"),
      ing("Cà chua bi"),
      ing("Dầu ăn Neptune"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "22",
    name: "Bún thịt heo trộn mắm",
    image: "/images/recipes/bun-thit-heo-tron-mam.jpg",
    ingredients: [
      ing("Bún khô"),
      ing("Thịt heo ba rọi"),
      ing("Nước mắm Nam Ngư"),
      ing("Hành Lá"),
    ],
  },
  {
    id: "23",
    name: "Mì xào rau củ",
    image: "/images/recipes/mien-xao-rau-cu.jpg",
    ingredients: [
      ing("Mì Hảo Hảo"),
      ing("Cà rốt"),
      ing("Rau muống"),
      ing("Dầu ăn Neptune"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "24",
    name: "Cơm rong biển đơn giản",
    image: "/images/recipes/com-rong-bien-don-gian.jpg",
    ingredients: [
      ing("Gạo ST25"),
      ing("Rong biển rắc giòn gia vị"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "25",
    name: "Canh khổ qua nhồi thịt",
    image: "/images/recipes/canh-kho-qua-nhoi-thit.jpg",
    ingredients: [
      ing("Khổ qua sơ chế"),
      ing("Thịt heo ba rọi"),
      ing("Hành Lá"),
      ing("Nước mắm Nam Ngư"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "26",
    name: "Gà nướng mật ong",
    image: "/images/recipes/ga-nuong-mat-ong.jpg",
    ingredients: [ing("Đùi gà ta"), ing("Muối i-ốt"), ing("Dầu ăn Neptune")],
  },
  {
    id: "27",
    name: "Bạch tuộc hấp sả",
    image: "/images/recipes/bach-tuoc-hap-xa.jpg",
    ingredients: [
      ing("Bạch tuộc"),
      ing("Hành Lá"),
      ing("Muối i-ốt"),
      ing("Nước mắm Nam Ngư"),
    ],
  },
  {
    id: "28",
    name: "Cơm chiên trứng",
    image: "/images/recipes/com-chien-trung.jpg",
    ingredients: [
      ing("Gạo ST25"),
      ing("Hành Lá"),
      ing("Muối i-ốt"),
      ing("Dầu ăn Neptune"),
    ],
  },
  {
    id: "29",
    name: "Nấm kim châm hấp",
    image: "/images/recipes/can-nam-kim-cham-hap.jpg",
    ingredients: [
      ing("Nấm kim châm"),
      ing("Hành Lá"),
      ing("Muối i-ốt"),
      ing("Dầu ăn Neptune"),
    ],
  },
  {
    id: "30",
    name: "Mực chiên nước mắm",
    image: "/images/recipes/muc-chien-nuoc-mam.jpg",
    ingredients: [
      ing("Râu mực"),
      ing("Nước mắm Nam Ngư"),
      ing("Muối i-ốt"),
      ing("Dầu ăn Neptune"),
    ],
  },
  {
    id: "31",
    name: "Canh măng chua cá basa",
    image: "/images/recipes/canh-mang-chua-ca-basa.jpg",
    ingredients: [
      ing("Cá basa phi lê"),
      ing("Hành Lá"),
      ing("Muối i-ốt"),
      ing("Nước mắm Nam Ngư"),
    ],
  },
  {
    id: "32",
    name: "Cải thìa xào thịt bò",
    image: "/images/recipes/cai-thia-xao-thit-bo.jpg",
    ingredients: [
      ing("Cải thìa"),
      ing("Nạm bò"),
      ing("Dầu ăn Neptune"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "33",
    name: "Bắp bò kho tiêu",
    image: "/images/recipes/bap-bo-kho-tieu.jpg",
    ingredients: [
      ing("Bắp bò"),
      ing("Hành Lá"),
      ing("Muối i-ốt"),
      ing("Nước mắm Nam Ngư"),
      ing("Dầu ăn Neptune"),
    ],
  },
  {
    id: "34",
    name: "Thịt heo kho gừng",
    image: "/images/recipes/thit-heo-kho-gung.jpg",
    ingredients: [
      ing("Thịt heo ba rọi"),
      ing("Nước mắm Nam Ngư"),
      ing("Muối i-ốt"),
      ing("Hành Lá"),
    ],
  },
  {
    id: "35",
    name: "Cá hồi sốt tiêu đen",
    image: "/images/recipes/ca-hoi-sot-tieu-den.jpg",
    ingredients: [
      ing("Cá hồi cắt lát"),
      ing("Muối i-ốt"),
      ing("Dầu ăn Neptune"),
    ],
  },
  {
    id: "36",
    name: "Ức gà sốt chua ngọt",
    image: "/images/recipes/uc-ga-sot-chua-ngot.jpg",
    ingredients: [
      ing("Ức gà phi lê"),
      ing("Nước tương Maggi"),
      ing("Muối i-ốt"),
      ing("Dầu ăn Neptune"),
    ],
  },
  {
    id: "37",
    name: "Salad bầu trộn giấm",
    image: "/images/recipes/salad-bau-tron-giam.jpg",
    ingredients: [ing("Bầu sao"), ing("Dầu ăn Neptune"), ing("Muối i-ốt")],
  },
  {
    id: "38",
    name: "Bí xanh hấp",
    image: "/images/recipes/bi-xanh-hap.jpg",
    ingredients: [
      ing("Bí xanh"),
      ing("Hành Lá"),
      ing("Muối i-ốt"),
      ing("Dầu ăn Neptune"),
    ],
  },
  {
    id: "40",
    name: "Cải bẹ xanh luộc",
    image: "/images/recipes/cai-be-xanh-luoc.jpg",
    ingredients: [ing("Cải bẹ xanh"), ing("Muối i-ốt")],
  },
  {
    id: "41",
    name: "Canh rau mồng tơi nấu tôm",
    image: "/images/recipes/canh-rau-mong-toi-nau-tom.jpg",
    ingredients: [
      ing("Rau mồng tơi"),
      ing("Hành Lá"),
      ing("Muối i-ốt"),
      ing("Nước mắm Nam Ngư"),
    ],
  },
  {
    id: "42",
    name: "Cá basa kho nghệ",
    image: "/images/recipes/ca-basa-kho-nghe.jpg",
    ingredients: [
      ing("Cá basa phi lê"),
      ing("Nước mắm Nam Ngư"),
      ing("Muối i-ốt"),
      ing("Dầu ăn Neptune"),
    ],
  },
  {
    id: "43",
    name: "Xà lách trộn dầu giấm",
    image: "/images/recipes/xa-lach-tron-dau-giam.jpg",
    ingredients: [
      ing("Xà lách thuỷ tinh thuỷ canh"),
      ing("Dầu ăn Neptune"),
      ing("Muối i-ốt"),
    ],
  },
  {
    id: "44",
    name: "Mì xào chay",
    image: "/images/recipes/my-xao-chay.jpg",
    ingredients: [
      ing("Mì Hảo Hảo"),
      ing("Cải bẹ xanh"),
      ing("Dầu ăn Neptune"),
      ing("Muối i-ốt"),
    ],
  },
];

// GET /api/recipes
router.get("/", (req, res) => {
  const { q } = req.query;
  if (q) {
    const query = q.toLowerCase();
    return res.json(
      RECIPES.filter((r) => r.name.toLowerCase().includes(query)),
    );
  }
  res.json(RECIPES);
});

// GET /api/recipes/:id
router.get("/:id", (req, res) => {
  const recipe = RECIPES.find((r) => r.id === req.params.id);
  if (!recipe)
    return res.status(404).json({ message: "Không tìm thấy công thức" });
  res.json(recipe);
});

module.exports = router;
