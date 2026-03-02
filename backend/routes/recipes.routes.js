"use strict";

const express = require("express");
const router = express.Router();

function ing(name) {
  return { name, qty: "1", unit: "phần" };
}

const RECIPES = [
  { id: "1", name: "Canh bí đỏ", image: "/images/recipes/canh-bi-do.jpg", ingredients: [ing("Bí đỏ"), ing("Thịt heo"), ing("Hành lá"), ing("Nước mắm")] },
  { id: "2", name: "Cá kho tộ", image: "/images/recipes/ca-kho-to.jpg", ingredients: [ing("Cá basa"), ing("Nước mắm"), ing("Đường")] },
  { id: "3", name: "Rau muống xào tỏi", image: "/images/recipes/rau-muong-xao.jpg", ingredients: [ing("Rau muống"), ing("Dầu ăn"), ing("Muối")] },
  { id: "4", name: "Canh chua cá basa", image: "/images/recipes/canh-chua-ca-basa.jpg", ingredients: [ing("Cá basa"), ing("Cà chua"), ing("Ngò Gai"), ing("Muối"), ing("Nước mắm")] },
  { id: "5", name: "Canh rau mồng tơi", image: "/images/recipes/canh-rau-mong-toi.jpg", ingredients: [ing("Rau mồng tơi"), ing("Hành lá"), ing("Muối")] },
  { id: "6", name: "Khoai tây xào thịt heo", image: "/images/recipes/khoai-tay-xao-thit-heo.jpg", ingredients: [ing("Khoai tây"), ing("Thịt heo"), ing("Hành lá"), ing("Dầu ăn"), ing("Muối")] },
  { id: "7", name: "Cà rốt xào nấm rơm", image: "/images/recipes/ca-rot-xao-nam-rom.jpg", ingredients: [ing("Cà rốt"), ing("Nấm rơm"), ing("Dầu ăn"), ing("Muối")] },
  { id: "8", name: "Cải ngọt xào", image: "/images/recipes/cai-ngot-xao.jpg", ingredients: [ing("Cải ngọt"), ing("Nước tương"), ing("Dầu ăn"), ing("Muối")] },
  { id: "9", name: "Canh bí xanh thịt heo", image: "/images/recipes/canh-bi-xanh-thit-heo.jpg", ingredients: [ing("Bí xanh"), ing("Thịt heo"), ing("Hành lá"), ing("Muối")] },
  { id: "10", name: "Canh bầu nấu thịt heo", image: "/images/recipes/canh-bau-thit-heo.jpg", ingredients: [ing("Bầu sao"), ing("Thịt heo"), ing("Hành lá"), ing("Muối")] },
  { id: "11", name: "Ức gà áp chảo", image: "/images/recipes/uc-ga-ap-chao.jpg", ingredients: [ing("Ức gà phi lê"), ing("Muối"), ing("Dầu ăn")] },
  { id: "12", name: "Nấm kim châm xào ức gà", image: "/images/recipes/nam-kim-cham-xao-uc-ga.jpg", ingredients: [ing("Nấm kim châm"), ing("Ức gà phi lê"), ing("Dầu ăn"), ing("Muối")] },
  { id: "13", name: "Đùi gà chiên nước mắm", image: "/images/recipes/dui-ga-chien-nuoc-mam.jpg", ingredients: [ing("Đùi gà ta"), ing("Nước mắm"), ing("Dầu ăn")] },
  { id: "14", name: "Cá hồi áp chảo", image: "/images/recipes/ca-hoi-ap-chao.jpg", ingredients: [ing("Cá hồi"), ing("Muối"), ing("Dầu ăn")] },
  { id: "15", name: "Cá basa chiên giòn", image: "/images/recipes/ca-basa-chien-gion.jpg", ingredients: [ing("Cá basa"), ing("Bột bánh rán"), ing("Dầu ăn"), ing("Muối")] },
  { id: "16", name: "Bắp bò hầm cà rốt", image: "/images/recipes/bop-bo-ham-ca-rot.jpg", ingredients: [ing("Bắp bò"), ing("Cà rốt"), ing("Hành lá"), ing("Muối")] },
  { id: "17", name: "Nạm bò xào cải ngồng", image: "/images/recipes/nam-bo-xao-cai-ngong.jpg", ingredients: [ing("Nạm bò"), ing("Cải ngồng"), ing("Dầu ăn"), ing("Muối")] },
  { id: "18", name: "Cải thìa xào nấm", image: "/images/recipes/cai-thia-xao-nam.jpg", ingredients: [ing("Cải thìa"), ing("Nấm rơm"), ing("Dầu ăn"), ing("Muối")] },
  { id: "19", name: "Bạch tuộc xào rau củ", image: "/images/recipes/bach-tuoc-xao-rau-cu.jpg", ingredients: [ing("Bạch tuộc"), ing("Cà rốt"), ing("Cải ngọt"), ing("Dầu ăn"), ing("Muối")] },
  { id: "20", name: "Mực xào hành hẹ", image: "/images/recipes/muc-xao-hanh-he.jpg", ingredients: [ing("Râu mực"), ing("Hành lá"), ing("Hẹ Lá"), ing("Dầu ăn"), ing("Muối")] },
  { id: "21", name: "Salad xà lách cà chua", image: "/images/recipes/salad-xa-lach-ca-chua.jpg", ingredients: [ing("Xà lách"), ing("Cà chua"), ing("Dầu ăn"), ing("Muối")] },
  { id: "22", name: "Bún thịt heo trộn mắm", image: "/images/recipes/bun-thit-heo-tron-mam.jpg", ingredients: [ing("Bún khô"), ing("Thịt heo"), ing("Nước mắm"), ing("Hành lá")] },
  { id: "23", name: "Mì xào rau củ", image: "/images/recipes/mien-xao-rau-cu.jpg", ingredients: [ing("Mì Hảo Hảo"), ing("Cà rốt"), ing("Rau muống"), ing("Dầu ăn"), ing("Muối")] },
  { id: "24", name: "Cơm rong biển đơn giản", image: "/images/recipes/com-rong-bien-don-gian.jpg", ingredients: [ing("Gạo ST25"), ing("Rong biển"), ing("Muối")] },
  { id: "25", name: "Canh khổ qua nhồi thịt", image: "/images/recipes/canh-kho-qua-nhoi-thit.jpg", ingredients: [ing("Khổ qua sơ chế"), ing("Thịt heo"), ing("Hành lá"), ing("Nước mắm"), ing("Muối")] },
  { id: "26", name: "Gà nướng mật ong", image: "/images/recipes/ga-nuong-mat-ong.jpg", ingredients: [ing("Đùi gà ta"), ing("Mật ong"), ing("Muối"), ing("Dầu ăn")] },
  { id: "27", name: "Bạch tuộc hấp xả", image: "/images/recipes/bach-tuoc-hap-xa.jpg", ingredients: [ing("Bạch tuộc"), ing("Hành lá"), ing("Muối"), ing("Nước mắm")] },
  { id: "28", name: "Cơm chiên trứng", image: "/images/recipes/com-chien-trung.jpg", ingredients: [ing("Gạo ST25"), ing("Trứng gà"), ing("Hành lá"), ing("Muối"), ing("Dầu ăn")] },
  { id: "29", name: "Nấm kim châm hấp", image: "/images/recipes/can-nam-kim-cham-hap.jpg", ingredients: [ing("Nấm kim châm"), ing("Hành lá"), ing("Muối"), ing("Dầu ăn")] },
  { id: "30", name: "Mực chiên nước mắm", image: "/images/recipes/muc-chien-nuoc-mam.jpg", ingredients: [ing("Râu mực"), ing("Nước mắm"), ing("Muối"), ing("Dầu ăn")] },
  { id: "31", name: "Canh măng chua cá basa", image: "/images/recipes/canh-mang-chua-ca-basa.jpg", ingredients: [ing("Cá basa"), ing("Măng chua"), ing("Hành lá"), ing("Muối"), ing("Nước mắm")] },
];

// GET /api/recipes
router.get("/", (req, res) => {
  const { q } = req.query;
  if (q) {
    const query = q.toLowerCase();
    return res.json(RECIPES.filter((r) => r.name.toLowerCase().includes(query)));
  }
  res.json(RECIPES);
});

// GET /api/recipes/:id
router.get("/:id", (req, res) => {
  const recipe = RECIPES.find((r) => r.id === req.params.id);
  if (!recipe) return res.status(404).json({ message: "Không tìm thấy công thức" });
  res.json(recipe);
});

module.exports = router;
