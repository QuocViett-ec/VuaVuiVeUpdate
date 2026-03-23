"use strict";

/**
 * Script cập nhật description cho từng sản phẩm trong MongoDB.
 * Chạy: node scripts/patch-descriptions.js
 * KHÔNG xóa dữ liệu đơn hàng/review.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Product = require("../models/Product.model");

const DESCRIPTIONS = {
  // ── RAU CỦ ──
  "100": "Rau muống tươi xanh thu hoạch trong ngày, vị ngọt nhẹ và mềm mại. Thích hợp xào tỏi, nấu canh hoặc luộc chấm mắm – món ăn quen thuộc của mọi gia đình Việt.",
  "101": "Cải bẹ xanh tươi non, thân giòn, vị ngọt thanh. Dùng nấu canh tôm, xào thịt hoặc nhúng lẩu đều ngon. Là nguồn chất xơ và vitamin C dồi dào cho bữa ăn hằng ngày.",
  "102": "Rau mồng tơi tươi, nhiều nhớt tự nhiên giúp nhuận trường và thanh nhiệt. Phù hợp nấu canh cua, luộc chấm mắm tỏi hay xào tỏi. Tốt cho tiêu hóa, dễ chế biến.",
  "103": "Cải thìa non mướt, thân trắng lá xanh đặc trưng. Vị ngọt dịu, giòn sần sật – thích hợp xào tỏi, nấu canh hoặc nhúng lẩu. Giàu canxi và vitamin K tốt cho xương khớp.",
  "110": "Cà rốt tươi chắc thịt, màu cam óng, vị ngọt tự nhiên. Dùng được nhiều cách: luộc, xào, hầm súp hay làm sinh tố. Giàu beta-carotene giúp bảo vệ mắt và tăng đề kháng.",
  "111": "Khoai tây tươi da mỏng, ruột vàng bở bùi. Dùng chiên, hầm bò, xào, nghiền hoặc làm khoai tây nướng phô mai đều tuyệt. Giàu tinh bột và kali, no lâu, tốt cho tim mạch.",
  "112": "Bí đỏ tươi vỏ xanh thịt vàng, vị bùi ngọt đặc trưng. Chế biến đa dạng: hầm xương, nấu cháo, hấp, rang hoặc làm bánh bí đỏ. Giàu vitamin A, tốt cho da và mắt.",
  "120": "Bầu sao tươi mướt, thịt trắng ngần, hấp thụ gia vị tốt. Rất hợp nấu canh tôm, xào thịt bằm hoặc hầm xương. Mát lành, dễ tiêu hóa, phù hợp cho cả người lớn tuổi và trẻ nhỏ.",
  "121": "Bí xanh tươi nguyên trái, thịt dày, mát lành. Thích hợp nấu canh sườn, xào tôm hoặc làm nước ép giải nhiệt mùa hè. Ít calo, giàu nước – lý tưởng cho người ăn kiêng.",
  "122": "Cà chua bi tươi đỏ mọng, vị chua ngọt dịu. Ăn sống, trộn salad, xào trứng hay nấu súp đều thơm ngon. Giàu lycopene – chất chống oxy hóa tự nhiên tốt cho tim mạch.",
  "130": "Nấm rơm tươi nguyên tai, mũ tròn đặc trưng, vị umami đậm đà. Kho thịt, xào tỏi, nấu lẩu hay làm soup đều hợp. Bổ dưỡng, ít calo, giàu đạm thực vật và khoáng chất.",
  "131": "Nấm kim châm tươi giòn, thân vàng nhạt, vị ngọt thanh. Nhúng lẩu, xào thịt bò, trộn gỏi hay nấu canh chay đều ngon. Giàu chất xơ và amino acid thiết yếu cho cơ thể.",
  "140": "Hành lá tươi xanh mướt, thơm nồng đặc trưng. Không thể thiếu khi nêm nếm canh, xào, cháo hoặc trang trí món ăn. Thu hoạch tươi ngày, đảm bảo hương vị đậm đà cho mọi bữa cơm.",
  "141": "Hẹ lá xanh mướt, mùi thơm nhẹ dễ chịu. Dùng xào trứng, làm nhân bánh bao hay nêm canh thêm hương vị. Là thảo dược dân gian tốt cho tiêu hóa và lưu thông máu.",
  "142": "Ngò gai tươi lá xanh đậm, mùi thơm đặc trưng rất riêng biệt. Không thể thiếu trong các món phở, bún bò, lẩu hay gỏi cuốn. Vị thơm nồng giúp cân bằng hương vị món ăn.",
  "150": "Cải bẹ dún mướt, lá xanh dày mập, nhai giòn sần sật. Rất thích hợp xào tỏi, nấu canh hoặc làm dưa cải chua. Giàu vitamin C và chất xơ, hỗ trợ tiêu hóa khỏe mạnh.",
  "151": "Cải ngồng tươi, cuống thon dài, vị ngọt nhẹ. Xào tỏi cho màu đẹp, vị ngon; luộc hay nấu canh cũng rất hợp. Dễ chế biến, bổ dưỡng – món rau phổ biến trong bữa cơm gia đình.",
  "152": "Cải ngọt non mướt, lá xanh mỏng, vị thanh ngọt tự nhiên. Xào tỏi nhanh tay cho bữa tối gọn lẹ, hay nấu canh thịt bằm cũng cực hợp. Bổ vitamin và khoáng chất cho cả nhà.",
  "153": "Cải thìa tươi giòn, thân trắng lá xanh, vị dịu ngọt. Thích hợp nhúng lẩu, xào tỏi hay nấu canh thanh đạm. Giàu canxi và folate – tốt đặc biệt cho phụ nữ mang thai.",
  "160": "Xà lách thủy canh trồng sạch không hóa chất, lá giòn mướt, màu xanh nhạt bắt mắt. Ăn sống trực tiếp, làm salad hay cuốn thịt đều thơm ngon. An tâm về vệ sinh an toàn thực phẩm.",
  "170": "Khổ qua đã được sơ chế sạch sẵn – tiết kiệm thời gian bếp núc. Vị đắng nhẹ đặc trưng giúp thanh nhiệt, hạ đường huyết. Dùng xào trứng, nhồi thịt hoặc nấu canh đều ngon.",
  // ── TRÁI CÂY ──
  "200": "Táo Mỹ nhập khẩu chính hãng, vỏ đỏ bóng, thịt giòn mọng nước, vị ngọt thanh cân bằng với chua nhẹ. Ăn tươi hoặc làm sinh tố, salad. Giàu chất xơ và chất chống oxy hóa.",
  "201": "Chuối Laba đặc sản Lâm Đồng – hương thơm dịu, vị ngọt sâu, ruột vàng ươm mịn màng. Ăn tươi, làm chuối chiên hay sinh tố đều tuyệt. Giàu kali và tinh bột – nguồn năng lượng tự nhiên.",
  "202": "Cam sành Vĩnh Long tươi nguyên quả, vỏ sần đặc trưng, múi ngọt nhiều nước. Vắt lấy nước uống mát lành hoặc ăn tươi đều ngon. Giàu vitamin C giúp tăng đề kháng mùa dịch.",
  "210": "Giỏ trái cây mix gồm nhiều loại trái cây tươi đa dạng, được tuyển chọn cẩn thận. Phù hợp làm quà biếu thăm hỏi người thân, bạn bè dịp lễ hay thăm bệnh. Trình bày đẹp mắt, ý nghĩa.",
  "211": "Giỏ quà trái cây cao cấp tuyển chọn những loại trái cây nhập khẩu và đặc sản chất lượng cao. Thiết kế sang trọng, phù hợp biếu tặng đối tác, sếp hay gia đình dịp lễ trọng. Ấn tượng và ý nghĩa.",
  "221": "Cam tươi Việt Nam chọn lọc, vỏ mỏng, múi đầy mọng nước và vị ngọt tự nhiên. Vắt nước uống giải khát hoặc ăn tươi đều tốt. Bổ sung vitamin C hằng ngày cực hiệu quả và tiết kiệm.",
  "231": "Nho nhập khẩu hạt to tròn đều, vỏ mỏng, ruột mọng, vị ngọt thanh. Ăn trực tiếp, làm hoa quả dầm hay trang trí bánh đều đẹp. Giàu resveratrol – chất chống lão hóa tự nhiên.",
  "240": "Chuối Laba mùa vụ tươi từ vườn Lâm Đồng, hương thơm đặc trưng, vị ngọt đậm hơn chuối thường. Ăn tươi bổ dưỡng hoặc chế biến thành các món ăn nhẹ. Nguồn năng lượng tự nhiên cho ngày dài.",
  // ── THỊT & CÁ ──
  "300": "Thịt ba rọi heo tươi, tỉ lệ nạc mỡ cân đối, thịt căng hồng đẹp mắt. Kho tàu, luộc thái mỏng chấm mắm hay cuốn bánh tráng đều ngon tuyệt. Giao trong ngày – đảm bảo độ tươi.",
  "301": "Sườn non heo tươi, xương mềm nhiều thịt bám, màu hồng tươi. Kho chua ngọt, hầm khoai tây hay nướng BBQ đều cho hương vị thơm ngon khó cưỡng. Giao trong ngày đảm bảo tươi sống.",
  "310": "Cá basa phi lê làm sẵn, không xương, thịt trắng mịn chắc. Chiên giòn, hấp gừng, kho nghệ hay nấu canh chua đều dễ làm và ngon miệng. Phù hợp cho cả gia đình kể cả trẻ nhỏ.",
  "311": "Cá hồi Na Uy nhập khẩu cắt lát sẵn, thịt cam đỏ óng ánh, giàu omega-3. Áp chảo bơ tỏi, sushi, sashimi hay hấp chanh đều tuyệt vời. Bổ sung dinh dưỡng thiết yếu cho tim mạch và não bộ.",
  "320": "Ức gà phi lê tươi, không da không xương, dễ cắt và chế biến. Ít béo, nhiều đạm – lý tưởng cho người ăn kiêng giảm cân. Nướng, luộc bún, áp chảo hay làm salad đều ngon và lành mạnh.",
  "321": "Đùi gà ta tươi nguyên con, da vàng đặc trưng gà thả vườn, thịt chắc và thơm. Chiên nước mắm, luộc chấm muối tiêu chanh hay kho gừng đều cho hương vị đậm đà khó quên.",
  "330": "Bắp bò tươi với vân thịt đẹp, kết cấu chắc và dai vừa phải. Hầm củ cải, bò kho hay cắt mỏng nhúng lẩu đều đưa cơm. Phần thịt giàu đạm và collagen tốt cho da và xương khớp.",
  "331": "Nạm bò tươi thớ thịt đều, lớp gân mỏng xen kẽ đặc trưng. Hầm mềm rục, bò kho tàu hoặc thái mỏng nhúng lẩu đều hợp vị. Nấu lâu ra nước ngọt ngon rất hấp dẫn cho cả gia đình.",
  "340": "Bạch tuộc biển tươi nguyên con, thịt dai giòn đặc trưng, vị ngọt của biển. Nướng mỡ hành, xào cay Hàn Quốc, làm sashimi hay lẩu hải sản đều hút hồn. Giàu protein và kẽm tốt cho sức khỏe.",
  "341": "Râu mực biển tươi, thớ giòn dai, vị ngọt mặn hải sản tự nhiên. Chiên giòn với bơ tỏi, xào sả ớt hay nướng than đều thơm phức. Món nhậu 'đỉnh' hay bữa cơm gia đình đều hợp.",
  // ── ĐỒ UỐNG ──
  "400": "Nước cam ép Twister vị tươi mát, được chiết xuất từ cam thật, giữ nguyên hương vị trái cây tự nhiên. Uống lạnh sau bữa ăn hay giải khát ngày nóng cực kỳ sảng khoái. Không chất bảo quản nhân tạo.",
  "401": "Nước ép táo nguyên chất từ táo tươi, không đường thêm, vị ngọt dịu thanh. Bổ sung vitamin và chất xơ hòa tan tốt cho tiêu hóa. Uống lạnh thẳng chai hoặc pha với nước soda đều ngon.",
  "410": "Sữa tươi tiệt trùng Vinamilk – thương hiệu sữa hàng đầu Việt Nam – giàu canxi và protein. Uống trực tiếp hay pha cà phê, nấu cháo đều ngon. Phù hợp cho cả trẻ nhỏ và người lớn.",
  "411": "Sữa đậu nành Fami không đường, từ đậu nành Việt Nam chọn lọc, vị bùi thơm nhẹ. Nguồn đạm thực vật tuyệt vời, tốt cho người ăn chay. Uống lạnh buổi sáng giúp khởi đầu ngày năng lượng.",
  "420": "Trà ô long Tea Plus vị thanh mát, không ngọt gắt, hương trà tự nhiên. Uống lạnh giải nhiệt hay uống ấm thưởng thức đều thích. Ít calo, phù hợp cho người giảm cân muốn thay thế nước ngọt.",
  "421": "Trà chanh C2 vị chua ngọt cân bằng, mùi chanh thơm nhẹ, giải khát cực tốt. Uống lạnh sau bữa ăn hay lúc học tập làm việc căng thẳng đều sảng khoái. Nước giải khát quen thuộc của người Việt.",
  "430": "7Up soda chanh mát lạnh, bong bóng li ti sảng khoái, vị chanh nhẹ cân bằng với gas. Uống thẳng hay pha cocktail đều ngon. Giải khát tức thì trong ngày hè nóng bức.",
  "431": "Fanta hương dâu lon màu đỏ bắt mắt, vị ngọt dâu thơm phức, gas sảng khoái. Thức uống yêu thích của giới trẻ – uống lạnh cực phê. Pha cùng đá bào làm slushie dâu tại nhà thật dễ.",
  "440": "Cà phê phin Phương Vy rang xay đặc trưng miền Nam, vị đậm đà hậu ngọt bền lâu. Pha phin truyền thống hoặc cold brew đều cho ly cà phê thơm ngon. Năng lượng khởi đầu ngày mới hoàn hảo.",
  "441": "Cà phê Trung Nguyên S blend đặc biệt – hương thơm Robusta đậm, vị đắng nhẹ cân bằng, hậu ngọt dịu. Pha phin hay máy espresso đều đậm đà. Thương hiệu cà phê biểu tượng của Việt Nam.",
  // ── HÀNG KHÔ ──
  "500": "Gạo ST25 – gạo ngon nhất thế giới 2019 theo giải thưởng quốc tế. Hạt dài trắng trong, cơm mềm dẻo, thơm nhẹ tự nhiên, không nhão. Phù hợp nấu cơm trắng thường nhật hay cơm hộp đặc biệt.",
  "501": "Gạo thơm Jasmine hạt dài đều, cơm nở mềm không dính, hương thơm thoang thoảng. Là lựa chọn kinh tế phù hợp cho bữa cơm gia đình hằng ngày. Nấu nhanh, ngon miệng và dễ bảo quản.",
  "510": "Mì Hảo Hảo tôm chua cay – hương vị quen thuộc nhất Việt Nam. Nấu nhanh trong 3 phút, thêm trứng và rau là đủ bữa. Vị đậm đà, sợi dai, là người bạn đồng hành trong những bữa ăn vội.",
  "511": "Bún khô sợi mịn đều từ gạo tẻ tinh chọn, nở đều khi trụng nước sôi. Nấu bún bò, bún thịt nướng hay bún riêu đều ngon. Bảo quản lâu không mốc, tiện lợi cho nhà bếp hiện đại.",
  "520": "Đậu xanh hạt mẩy xanh đều, vỏ mỏng dễ nấu nhừ. Nấu chè, xay bột làm bánh hay nấu cháo đều thơm bùi. Giàu protein thực vật, chất xơ và folate – tốt cho sức khỏe tim mạch.",
  "521": "Đậu đỏ hạt to tròn đều, màu đỏ tươi đặc trưng, vị bùi ngọt. Nấu chè đậu đỏ, hầm xương hay làm nhân bánh đều thơm ngon. Giàu sắt và protein, tốt cho người thiếu máu.",
  "530": "Bột phô mai StFood hương thơm béo ngậy, tan đều khi rắc lên bỏng ngô, mì, khoai chiên hay bánh mì. Vị umami đặc trưng giúp nâng tầm hương vị mọi món ăn nhẹ. Tiện dụng và hao phí thấp.",
  "531": "Bột bánh rán Ajinomoto – hỗn hợp bột pha sẵn chuyên dụng, giúp vỏ bánh giòn xốp bên ngoài, mềm bên trong. Không cần pha thêm nguyên liệu phức tạp. Làm bánh rán nhân thịt hay nhân ngọt đều ngon.",
  "540": "Rong biển rắc giòn gia vị – thơm giòn, vị umami đặc trưng của biển. Rắc lên cơm, mì, soup hay ăn kèm bánh mì đều ngon. Bổ sung iod và khoáng chất tự nhiên từ biển. Snack healthy hằng ngày.",
  "541": "Rong biển nướng chà bông cá hồi – kết hợp độc đáo giữa rong biển giòn và chà bông thơm béo. Ăn vặt cao cấp hoặc kẹp cơm nắm mang đi đều tiện. Dinh dưỡng tự nhiên, không phẩm màu.",
  "550": "Pate thịt bò Vissan thơm ngon, kết cấu mịn mượt, vị đậm đà. Phết bánh mì ăn sáng nhanh gọn, kẹp xà lách cà chua là bữa sáng đủ chất. Sản phẩm uy tín thương hiệu Vissan hơn 50 năm.",
  "551": "Thịt heo hai lát Vissan đóng hộp sẵn, thơm ngon, dễ bảo quản. Chiên nhanh ăn kèm cơm trắng hoặc phết bánh mì đều hợp. Giải pháp bữa ăn tiện lợi cho những ngày bận rộn không có thời gian nấu.",
  // ── GIA VỊ ──
  "600": "Nước mắm Nam Ngư 40 độ đạm – loại nước mắm công nghiệp bán chạy nhất Việt Nam. Vị mặn vừa, mùi thơm nhẹ, pha chế dễ dàng. Dùng nêm nếm canh, kho thịt hay pha nước chấm đều ngon.",
  "601": "Nước tương Maggi vị umami đặc trưng, màu nâu đen óng sánh. Thêm vài giọt khi xào rau, kho thịt hay ướp gà giúp món ăn đậm đà hơn hẳn. Thương hiệu gia vị tin cậy hơn 100 năm toàn cầu.",
  "610": "Dầu ăn Neptune tinh luyện từ hạt cải, trong suốt không màu, điểm bốc khói cao – thích hợp chiên xào ở nhiệt độ cao. Không chứa cholesterol, giàu omega-6. Dầu ăn được ưa chuộng nhất tại Việt Nam.",
  "620": "Muối i-ốt tinh sạch, hạt mịn trắng đều. Bổ sung i-ốt thiết yếu ngăn ngừa bướu cổ. Dùng nêm nếm, ướp thịt, ngâm rau hay chấm dưa cà đều tiện. Sản phẩm i-ốt hóa theo tiêu chuẩn Bộ Y tế.",
  "621": "Bột ngọt Ajinomoto – thương hiệu mì chính hàng đầu thế giới. Chỉ cần một nhúm nhỏ nêm canh, kho hay xào là nâng tầm hương vị ngay. Sản xuất từ quá trình lên men tự nhiên, an toàn được kiểm chứng.",
  "640": "Gia vị nướng BBQ pha sẵn với hỗn hợp tỏi, ớt, tiêu, gừng và gia vị đặc biệt. Ướp thịt 30 phút rồi nướng là có món BBQ thơm lừng. Tiện lợi không cần pha chế nhiều loại gia vị riêng lẻ.",
  "641": "Gia vị lẩu thái pha sẵn với sả, ớt, chanh và các thảo mộc đặc trưng. Nấu lẩu chua cay chuẩn vị Thái chỉ trong 10 phút. Vừa tiện lợi vừa đậm đà – giải pháp bữa tối ngon cho cả nhà.",
  // ── GIA DỤNG ──
  "700": "Túi rác đen dày dặn, dai bền không bị thủng dù đựng rác nặng. Cuộn gọn tiện dụng, dễ buộc miệng túi. Phù hợp cho thùng rác gia đình, văn phòng hay khu bếp. Sản phẩm thiết yếu mỗi ngày.",
  "701": "Túi rác màu sắc tươi sáng giúp phân loại rác dễ dàng theo màu. Chất liệu HDPE bền dai, không thấm nước, không mùi. Phù hợp hộ gia đình hay cơ sở kinh doanh áp dụng phân loại rác tại nguồn.",
  "710": "Nước rửa chén Sunlight gói nhỏ tiện lợi, bọt nhiều, tẩy sạch dầu mỡ nhanh chóng. Hương chanh dễ chịu, không gây khô tay khi dùng thường xuyên. Tiết kiệm, phù hợp mang đi du lịch hay dã ngoại.",
  "711": "Nước rửa chén Sunlight chai lớn – thương hiệu rửa chén hàng đầu Việt Nam. Công thức bọt dày, phá vỡ dầu mỡ tức thì, để lại mùi hương chanh dễ chịu. Bảo vệ đôi tay mềm mại sau nhiều lần rửa.",
  "720": "Dao bào rau củ nhựa an toàn, lưỡi thép không gỉ sắc bén đều tay. Bào cà rốt, khoai tây, dưa leo hay phô mai nhanh và đều hơn dao thường. Thiết kế gọn nhẹ dễ rửa, để tủ bếp tiện lợi.",
  "721": "Hộp đựng thực phẩm nắp kín chuẩn an toàn, không BPA, vào được lò vi sóng và tủ đông. Bảo quản thức ăn thừa, cất trữ rau củ hay mang cơm đến chỗ làm đều tiện lợi. Thiết kế chống đổ, xếp chồng gọn gàng.",
  "723": "Bộ 3 hũ gia vị thủy tinh hay nhựa cao cấp với nắp đậy kín, thiết kế đồng bộ. Sắp xếp bếp gọn gàng, nhìn đẹp mắt và dễ lấy dùng. Phù hợp đựng muối, đường, tiêu, bột ngọt và các gia vị khô.",
  "730": "Bột giặt Aba tẩy sạch cả vết bẩn cứng đầu, quần áo trắng sáng, màu bền lâu. Mùi hương dịu dễ chịu, ít bọt dễ xả, phù hợp cả giặt tay lẫn giặt máy. Lựa chọn tiết kiệm cho gia đình đông người.",
  "731": "Bột giặt Omo công thức lốc xoáy mạnh mẽ loại bỏ vết bẩn sâu từ 3 lớp vải. Phù hợp giặt máy cửa trước và cửa trên. Mùi thơm mới mẻ, quần áo sạch bóng và thơm cả ngày kể cả trời ẩm.",
  "740": "Khăn tắm cotton dày dặn, mềm mịn, thấm nước tốt. Sợi bông tự nhiên an toàn cho da nhạy cảm kể cả trẻ sơ sinh. Kích thước vừa đủ, dễ giặt nhanh khô. Màu sắc đa dạng phù hợp sở thích cả gia đình.",
  "741": "Giấy vệ sinh Puri nhiều lớp mịn mềm, tan nhanh trong nước không gây tắc bồn cầu. Không mùi hóa chất, an toàn cho da nhạy cảm. Cuộn giấy chắc, không bị bong lõi khi dùng. Sản phẩm vệ sinh gia đình tin cậy.",
  "750": "Kem đánh răng Closeup hương bạc hà mát lạnh, bọt dày giúp làm sạch mảng bám và trắng răng hiệu quả. Công thức Fluoride bảo vệ men răng, ngăn ngừa sâu răng. Hơi thở thơm mát bền lâu suốt cả ngày.",
  "751": "Kem dưỡng da Nivea Soft hương nhẹ dễ chịu, thẩm thấu nhanh không nhờn rít. Dưỡng ẩm sâu 24 giờ, da mềm mịn căng bóng. Phù hợp dùng toàn thân cho cả nam lẫn nữ. Thương hiệu chăm sóc da uy tín 130 năm.",
  "752": "Dầu gội Sunsilk công thức keratin giúp tóc chắc khỏe từ gốc, bồng bềnh nhẹ và bóng mướt. Mùi hương hoa quả dịu, tạo bọt tốt, làm sạch đầu hiệu quả. Phù hợp dùng hằng ngày cho mọi loại tóc.",
  // ── BÁNH KẸO ──
  "800": "Bánh Oreo nhân kem vani – biểu tượng bánh kẹo toàn cầu. Vỏ bánh cacao giòn, nhân kem trắng ngọt mịn. Nhúng sữa ăn theo phong cách 'tách đôi – liếm nhân – nhúng sữa' là trải nghiệm khó quên.",
  "801": "Bánh gạo One One giòn tan, vị ngọt nhẹ tự nhiên từ gạo rang. Ăn vặt nhẹ nhàng không nặng bụng, phù hợp cả trẻ em và người lớn. Ít calo so với bánh quy thông thường – snack lành mạnh hằng ngày.",
  "810": "Socola Snickers nhân lạc rang bơ caramel phủ socola sữa đậm đà. Vị ngọt béo kết hợp lạc giòn tạo nên hương vị đặc trưng khó quên. Thanh socola nhanh chóng bổ sung năng lượng khi đói giữa buổi.",
  "820": "Kẹo Alpenliebe hương dâu kem – kẹo ngậm mềm tan dần trong miệng, vị dâu chua ngọt đặc trưng. Hương thơm dịu mát, quen thuộc với nhiều thế hệ. Bao gói đẹp phù hợp cả ăn vặt và tặng trẻ em.",
  "821": "Kẹo bạc hà Mentos viên tròn giòn ngoài mềm trong, vị bạc hà mát lạnh tươi sảng khoái. Làm thơm miệng hiệu quả sau bữa ăn hoặc khi họp hành. Bao bì cuộn gọn tiện mang theo trong túi xách.",
  "830": "Granola giòn mix hạt và trái cây sấy tự nhiên, không phẩm màu hay chất bảo quản. Ăn với sữa chua, sữa hạt hay ăn khô snack đều ngon. Bữa sáng nhanh gọn đủ dinh dưỡng cho người bận rộn yêu sức khỏe.",
  "840": "Chuối sấy giòn vàng óng, vị ngọt đậm cô đọng tự nhiên, không thêm đường tinh luyện. Snack healthy mang đi học, đi làm hay xem phim cực tiện. Giàu kali và magie, bổ sung năng lượng tức thì.",
  "841": "Mít sấy giòn từ mít chín cây tự nhiên, vị ngọt thơm đặc trưng miền Nam. Không dầu chiên, không chất bảo quản – snack sạch cho cả gia đình. Giàu vitamin C và chất xơ, tốt cho tiêu hóa.",
  "842": "Xoài sấy dẻo vị chua ngọt tự nhiên, thơm mùi xoài chín, không dùng chất bảo quản hay tạo màu. Snack lý tưởng cho cả nhà – ăn vặt lành mạnh mà không lo béo. Tiện mang theo mọi lúc mọi nơi.",
  "561": "Hạt hạnh nhân rang khô tự nhiên, giòn bùi, hương thơm dịu nhẹ. Ăn vặt healthy, rắc vào salad, granola hay làm bánh đều tuyệt. Giàu vitamin E, magie và chất béo lành mạnh – tốt cho tim và não.",
};

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB kết nối thành công");

    let updated = 0;
    let notFound = 0;

    for (const [extId, desc] of Object.entries(DESCRIPTIONS)) {
      const result = await Product.updateOne(
        { externalId: extId },
        { $set: { description: desc } }
      );
      if (result.matchedCount > 0) {
        updated++;
      } else {
        console.warn(`  ⚠️  Không tìm thấy sản phẩm externalId=${extId}`);
        notFound++;
      }
    }

    console.log(`\n✅ Cập nhật xong: ${updated} sản phẩm`);
    if (notFound > 0) console.log(`⚠️  Không tìm thấy: ${notFound} sản phẩm`);
  } catch (err) {
    console.error("❌ Lỗi:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Đã ngắt kết nối MongoDB");
  }
}

run();
