/* ============================================================
 * 本地知识库：热门目的地（景点坐标、美食、类型、玩点、交通）
 * 纯静态、离线可用；未收录目的地会走「通用生成」逻辑。
 *
 * 景点字段：
 *  - desc        一句话简介
 *  - highlights  具体玩点（2~4 条）
 *  - duration    建议游玩时长
 *  - metro       { line, station, walk } 最近地铁（无则 null）
 *  - get         非地铁景点的「怎么去」提示
 * ============================================================ */
(function (global) {
  'use strict';

  var DB = {
    '北京': {
      name: '北京', province: '北京市', type: 'historic', region: '华北',
      lat: 39.9042, lng: 116.4074,
      overview: '六朝古都，历史与现代交融，故宫、长城、胡同是必打卡的文化符号。',
      attractions: [
        { name: '故宫博物院', lat: 39.9163, lng: 116.3972, category: '历史', duration: '3-4小时',
          desc: '明清两代皇宫，世界现存规模最大的木结构古建筑群。',
          highlights: ['沿中轴线看太和殿、乾清宫等三大殿', '逛珍宝馆、钟表馆看皇家珍藏', '走东西六宫与御花园，感受宫廷生活'],
          metro: { line: '地铁1号线', station: '天安门东站', walk: '约800米' } },
        { name: '天安门广场', lat: 39.9087, lng: 116.3975, category: '地标', duration: '1-2小时',
          desc: '首都中心广场，看升旗、人民英雄纪念碑、国家博物馆。',
          highlights: ['清晨看升旗仪式（需提前查时间并预约）', '打卡人民英雄纪念碑、毛主席纪念堂', '进国家博物馆看国宝文物'],
          metro: { line: '地铁1号线', station: '天安门东站', walk: '约300米' } },
        { name: '八达岭长城', lat: 40.3592, lng: 116.0202, category: '历史', duration: '半天',
          desc: '“不到长城非好汉”，山势险峻、视野开阔。',
          highlights: ['登好汉坡，眺望连绵山脊上的长城', '坐缆车/索道上山省体力', '看北八楼、烽火台等经典段落'],
          metro: null, get: '市郊铁路S2线或877路公交，约1.5小时' },
        { name: '颐和园', lat: 39.9996, lng: 116.2755, category: '园林', duration: '3小时',
          desc: '皇家园林，昆明湖与万寿山相映成趣。',
          highlights: ['沿长廊走一走，看彩绘与昆明湖', '登佛香阁俯瞰全园', '乘船游昆明湖、逛十七孔桥'],
          metro: { line: '地铁4号线', station: '北宫门站', walk: '约800米' } },
        { name: '天坛公园', lat: 39.8822, lng: 116.4066, category: '历史', duration: '2小时',
          desc: '明清皇帝祭天祈谷之所，祈年殿是北京标志。',
          highlights: ['看祈年殿三重檐圆顶', '在回音壁、圜丘体验声学奇观', '清晨看老北京人晨练抖空竹'],
          metro: { line: '地铁5号线', station: '天坛东门站', walk: '约200米' } }
      ],
      foods: [
        { name: '北京烤鸭', desc: '皮脆肉嫩，配薄饼、甜面酱、葱丝，代表名店全聚德、便宜坊。' },
        { name: '老北京炸酱面', desc: '手擀面配黄酱肉丁炸酱与菜码，咸香浓郁。' },
        { name: '豆汁儿配焦圈', desc: '地道老北京风味，酸香独特，值得一试。' },
        { name: '卤煮火烧', desc: '猪肠、火烧、豆腐同煮，酱香醇厚，胡同里的烟火气。' }
      ],
      tips: '故宫需提前线上预约；长城可乘市郊铁路或公交前往，建议早出避峰。'
    },

    '上海': {
      name: '上海', province: '上海市', type: 'city', region: '华东',
      lat: 31.2304, lng: 121.4737,
      overview: '国际大都会，外滩万国建筑与陆家嘴天际线同框，弄堂市井与时尚潮流并存。',
      attractions: [
        { name: '外滩', lat: 31.2400, lng: 121.4900, category: '地标', duration: '1-2小时',
          desc: '黄浦江畔万国建筑群，隔江对望陆家嘴“三件套”。',
          highlights: ['沿江堤看万国建筑博览群', '夜晚看陆家嘴灯光与游船', '从外白渡桥走到十六铺码头'],
          metro: { line: '地铁2/10号线', station: '南京东路站', walk: '约700米' } },
        { name: '东方明珠', lat: 31.2397, lng: 121.4998, category: '地标', duration: '2小时',
          desc: '上海标志性电视塔，透明悬空观光廊俯瞰全城。',
          highlights: ['登259米透明悬空观光廊', '看上海城市历史发展陈列馆', '俯瞰陆家嘴与黄浦江全景'],
          metro: { line: '地铁2号线', station: '陆家嘴站', walk: '约600米' } },
        { name: '豫园', lat: 31.2274, lng: 121.4921, category: '园林', duration: '2小时',
          desc: '明代江南园林，九曲桥、湖心亭与城隍庙小吃街相邻。',
          highlights: ['看九曲桥、湖心亭与假山', '逛点春堂、玉玲珑奇石', '到城隍庙吃南翔小笼'],
          metro: { line: '地铁10号线', station: '豫园站', walk: '约400米' } },
        { name: '上海迪士尼乐园', lat: 31.1433, lng: 121.6574, category: '乐园', duration: '1天',
          desc: '内地首座迪士尼，奇幻童话城堡、花车巡游与烟花秀。',
          highlights: ['打卡奇幻童话城堡', '刷创极速光轮、翱翔飞越地平线等热门项目', '看花车巡游与夜间烟花'],
          metro: { line: '地铁11号线', station: '迪士尼站', walk: '约500米' } },
        { name: '田子坊', lat: 31.2118, lng: 121.4692, category: '街区', duration: '2小时',
          desc: '石库门里弄改造的创意街区，手作小店与咖啡馆林立。',
          highlights: ['逛石库门老建筑里的小店', '淘手作、文创与 vintage', '在弄堂咖啡馆闲坐'],
          metro: { line: '地铁9号线', station: '打浦桥站', walk: '约300米' } }
      ],
      foods: [
        { name: '南翔小笼包', desc: '皮薄汁多，先开窗后喝汤，城隍庙排队名吃。' },
        { name: '生煎馒头', desc: '底脆、汁鲜、肉香，配咖喱牛肉汤更地道。' },
        { name: '本帮红烧肉', desc: '浓油赤酱，入口即化，甜咸适口。' },
        { name: '葱油拌面', desc: '葱香四溢的简单美味，上海人的家常味道。' }
      ],
      tips: '地铁网络发达，建议公共交通出行；外滩夜景约18:00后亮灯。'
    },

    '杭州': {
      name: '杭州', province: '浙江省', type: 'city', region: '华东',
      lat: 30.2741, lng: 120.1551,
      overview: '“上有天堂，下有苏杭”，西湖山水、茶园灵隐，温润江南的代表。',
      attractions: [
        { name: '西湖', lat: 30.2433, lng: 120.1433, category: '自然', duration: '半天',
          desc: '苏堤春晓、断桥残雪、三潭印月，环湖十景步步皆画。',
          highlights: ['沿苏堤、白堤漫步或骑行', '乘船登三潭印月小岛', '在断桥、雷峰塔拍经典机位'],
          metro: { line: '地铁1号线', station: '龙翔桥站', walk: '约500米' } },
        { name: '灵隐寺', lat: 30.2400, lng: 120.0975, category: '寺庙', duration: '2-3小时',
          desc: '千年古刹，飞来峰石窟造像精美，香火鼎盛。',
          highlights: ['看飞来峰摩崖石窟造像', '参拜大雄宝殿与济公殿', '在永福寺、韬光寺感受幽静'],
          metro: { line: '地铁3号线', station: '黄龙体育中心站', walk: '转7路/灵隐专线约20分钟' } },
        { name: '雷峰塔', lat: 30.2305, lng: 120.1470, category: '历史', duration: '1-2小时',
          desc: '《白蛇传》传说地，登塔俯瞰西湖全景。',
          highlights: ['登塔看西湖与城市全景', '看塔内白蛇传浮雕与旧塔遗址', '黄昏拍“雷峰夕照”'],
          metro: { line: '地铁1号线', station: '龙翔桥站', walk: '转4路公交约15分钟' } },
        { name: '西溪国家湿地公园', lat: 30.2720, lng: 120.0610, category: '自然', duration: '3小时',
          desc: '城中湿地，摇橹船穿行芦苇荡，清幽宜人。',
          highlights: ['坐摇橹船穿行芦苇荡', '走福堤、绿堤看水生植物', '在洪园看江南园林与村落'],
          metro: { line: '地铁3号线', station: '西溪湿地南站', walk: '约800米' } },
        { name: '龙井村', lat: 30.2190, lng: 120.1060, category: '茶园', duration: '2小时',
          desc: '西湖龙井产地，茶园叠翠，可品明前新茶。',
          highlights: ['在茶园徒步、拍照', '看茶农炒茶、品明前龙井', '走“十里琅珰”山脊步道'],
          metro: null, get: '公交27/87路直达，或打车约20分钟' }
      ],
      foods: [
        { name: '西湖醋鱼', desc: '草鱼烹制，酸甜鲜嫩，杭帮菜代表。' },
        { name: '东坡肉', desc: '肥而不腻，酥烂醇香，以黄酒慢炖。' },
        { name: '龙井虾仁', desc: '龙井茶香配河虾仁，清鲜爽口。' },
        { name: '定胜糕', desc: '软糯米糕，寓意吉祥，湖滨老字号有售。' }
      ],
      tips: '西湖景区建议骑行或步行；旺季灵隐寺、雷峰塔需提前预约。'
    },

    '成都': {
      name: '成都', province: '四川省', type: 'city', region: '西南',
      lat: 30.5728, lng: 104.0668,
      overview: '天府之国、美食之都，慢生活的代名词，火锅、熊猫与茶馆文化令人流连。',
      attractions: [
        { name: '成都大熊猫繁育研究基地', lat: 30.7330, lng: 104.1460, category: '动物', duration: '半天',
          desc: '看国宝大熊猫吃竹玩耍，建议上午前往。',
          highlights: ['看大熊猫幼崽与成年熊猫进食', '逛月亮产房、太阳产房', '看小熊猫与天鹅湖'],
          metro: { line: '地铁3号线', station: '熊猫大道站', walk: '转景区接驳车约10分钟' } },
        { name: '宽窄巷子', lat: 30.6667, lng: 104.0550, category: '街区', duration: '2小时',
          desc: '宽巷子、窄巷子、井巷子，明清老街里的川西院落与小吃。',
          highlights: ['逛川西院落与青砖灰瓦', '尝三大炮、糖油果子等小吃', '在茶馆喝盖碗茶看变脸'],
          metro: { line: '地铁4号线', station: '宽窄巷子站', walk: '约200米' } },
        { name: '武侯祠·锦里', lat: 30.6486, lng: 104.0470, category: '历史', duration: '2-3小时',
          desc: '纪念诸葛亮的祠庙，隔壁锦里古街红灯笼夜景很有氛围。',
          highlights: ['看三绝碑与诸葛亮的祠堂', '逛锦里古街的灯笼夜景', '吃锦里小吃、看皮影戏'],
          metro: { line: '地铁3号线', station: '高升桥站', walk: '约800米' } },
        { name: '杜甫草堂', lat: 30.6630, lng: 104.0260, category: '历史', duration: '2小时',
          desc: '诗圣杜甫故居，园林清幽，茅屋与诗碑引人怀古。',
          highlights: ['看杜甫茅屋与诗史堂', '逛浣花溪畔的清幽园林', '赏红墙竹影的经典机位'],
          metro: { line: '地铁4号线', station: '草堂北路站', walk: '约600米' } },
        { name: '都江堰', lat: 31.0020, lng: 103.6180, category: '工程', duration: '半天',
          desc: '两千多年的无坝引水工程，至今仍灌溉成都平原。',
          highlights: ['看鱼嘴、飞沙堰、宝瓶口三大工程', '走安澜索桥', '登玉垒山俯瞰全貌'],
          metro: null, get: '城际列车犀浦站→离堆公园站，约30分钟' }
      ],
      foods: [
        { name: '四川火锅', desc: '牛油红锅麻辣鲜香，毛肚、黄喉、鸭肠是标配。' },
        { name: '串串香', desc: '竹签串菜，按签计费，街头巷尾的平民美食。' },
        { name: '担担面', desc: '肉臊、花生碎、红油拌面，麻辣开胃。' },
        { name: '兔头', desc: '五香与麻辣双味，本地人的夜宵心头好。' }
      ],
      tips: '市区公共交通便利；熊猫基地距市区约10公里，可地铁+接驳车。'
    },

    '重庆': {
      name: '重庆', province: '重庆市', type: 'city', region: '西南',
      lat: 29.5630, lng: 106.5516,
      overview: '8D魔幻山城，江景、夜景与麻辣火锅闻名，轻轨穿楼、立体交通独具魅力。',
      attractions: [
        { name: '洪崖洞', lat: 29.5630, lng: 106.5820, category: '街区', duration: '2小时',
          desc: '吊脚楼建筑群，夜晚灯火璀璨如《千与千寻》场景。',
          highlights: ['看11层吊脚楼的立体夜景', '坐电梯逐层逛美食与手作', '到千厮门大桥拍全景'],
          metro: { line: '地铁1/6号线', station: '小什字站', walk: '约500米' } },
        { name: '解放碑', lat: 29.5580, lng: 106.5740, category: '地标', duration: '1-2小时',
          desc: '重庆商业中心与抗战胜利纪功碑，周边商圈繁华。',
          highlights: ['打卡人民解放纪念碑', '逛八一好吃街吃小吃', '感受山城最繁华商圈'],
          metro: { line: '地铁2号线', station: '临江门站', walk: '约300米' } },
        { name: '磁器口古镇', lat: 29.5800, lng: 106.4480, category: '古镇', duration: '2-3小时',
          desc: '千年古镇，麻花、陈昌银小吃，青石板街巷。',
          highlights: ['走青石板老街', '排队买陈麻花', '在江边茶馆喝茶看江景'],
          metro: { line: '地铁1号线', station: '磁器口站', walk: '约300米' } },
        { name: '长江索道', lat: 29.5560, lng: 106.5860, category: '体验', duration: '1小时',
          desc: '横跨长江的空中索道，感受山城立体交通。',
          highlights: ['乘索道横跨长江', '空中俯瞰江面与两岸', '拍“空中巴士”经典视角'],
          metro: { line: '地铁1/6号线', station: '小什字站', walk: '约400米' } },
        { name: '武隆天生三桥', lat: 29.4450, lng: 107.7970, category: '自然', duration: '1天',
          desc: '世界自然遗产，喀斯特天坑地缝，电影取景地。',
          highlights: ['看天龙桥、青龙桥、黑龙桥三座天生桥', '走天坑底部栈道', '打卡《满城尽带黄金甲》取景地'],
          metro: null, get: '重庆北乘火车至武隆站，再转旅游车约1.5小时' }
      ],
      foods: [
        { name: '重庆火锅', desc: '九宫格牛油锅，麻辣鲜香，越煮越入味。' },
        { name: '重庆小面', desc: '麻辣鲜香的一碗面，早餐灵魂。' },
        { name: '酸辣粉', desc: '红薯粉条配红油酸汤，酸辣开胃。' },
        { name: '毛血旺', desc: '鸭血、毛肚、午餐肉麻辣一锅，下饭利器。' }
      ],
      tips: '山城坡多，穿舒适平底鞋；洪崖洞免费但人流大，注意错峰。'
    },

    '西安': {
      name: '西安', province: '陕西省', type: 'historic', region: '西北',
      lat: 34.3416, lng: 108.9398,
      overview: '十三朝古都，兵马俑、城墙、钟鼓楼，处处是穿越千年的历史现场。',
      attractions: [
        { name: '秦始皇兵马俑博物馆', lat: 34.3841, lng: 109.2785, category: '历史', duration: '半天',
          desc: '世界第八大奇迹，数千陶俑气势震撼。',
          highlights: ['看一号坑的千人千面陶俑军阵', '看铜车马与二号、三号坑', '听讲解了解秦代军制'],
          metro: null, get: '地铁9号线华清池站转游5/914路，或乘游5路直达' },
        { name: '大雁塔', lat: 34.2180, lng: 108.9640, category: '历史', duration: '2小时',
          desc: '玄奘译经之地，北广场音乐喷泉夜晚美轮美奂。',
          highlights: ['登塔俯瞰西安城', '看北广场亚洲最大音乐喷泉', '逛大唐不夜城看夜景'],
          metro: { line: '地铁3/4号线', station: '大雁塔站', walk: '约400米' } },
        { name: '西安城墙', lat: 34.2550, lng: 108.9440, category: '历史', duration: '2-3小时',
          desc: '保存最完整的古城墙，可骑行环游一周。',
          highlights: ['租自行车环城墙骑行', '看敌楼、箭楼与护城河', '黄昏看城墙亮灯'],
          metro: { line: '地铁2号线', station: '永宁门站', walk: '约300米' } },
        { name: '钟鼓楼', lat: 34.2610, lng: 108.9420, category: '地标', duration: '1-2小时',
          desc: '西安城中心地标，晨钟暮鼓，回民街近在咫尺。',
          highlights: ['登钟楼看东西南北大街', '看鼓楼与24节气鼓', '到回民街吃小吃'],
          metro: { line: '地铁2号线', station: '钟楼站', walk: '约200米' } },
        { name: '华清宫', lat: 34.3610, lng: 109.2080, category: '历史', duration: '2-3小时',
          desc: '唐代皇家温泉行宫，杨贵妃故事与骊山风光。',
          highlights: ['看唐代御汤遗址', '登骊山看兵谏亭', '看《长恨歌》实景演出'],
          metro: { line: '地铁9号线', station: '华清池站', walk: '约600米' } }
      ],
      foods: [
        { name: '肉夹馍', desc: '腊汁肉夹白吉馍，肥瘦相间、馍酥肉香。' },
        { name: '羊肉泡馍', desc: '手掰馍配羊肉汤，暖胃顶饱的西北风味。' },
        { name: '凉皮', desc: '酸辣爽滑，夏天来一碗最解暑。' },
        { name: 'Biangbiang面', desc: '裤带面配油泼辣子，筋道十足。' }
      ],
      tips: '兵马俑距市区约40公里，可乘游5路公交或地铁+摆渡车。'
    },

    '广州': {
      name: '广州', province: '广东省', type: 'city', region: '华南',
      lat: 23.1291, lng: 113.2644,
      overview: '千年商都、美食天堂，“食在广州”，早茶文化与珠江夜景不容错过。',
      attractions: [
        { name: '广州塔（小蛮腰）', lat: 23.1066, lng: 113.3246, category: '地标', duration: '2小时',
          desc: '广州新地标，450米观景台与摩天轮俯瞰全城。',
          highlights: ['登450米观景台俯瞰珠江', '坐塔顶摩天轮', '看珠江两岸夜景'],
          metro: { line: '地铁3号线/APM线', station: '广州塔站', walk: '约300米' } },
        { name: '白云山', lat: 23.1820, lng: 113.2940, category: '自然', duration: '半天',
          desc: '“羊城第一秀”，登摩星岭可眺望市区全景。',
          highlights: ['登摩星岭看广州全景', '坐索道上山', '在山间步道吸氧徒步'],
          metro: null, get: '地铁2号线白云公园站，转公交/打车约10分钟' },
        { name: '陈家祠', lat: 23.1290, lng: 113.2460, category: '建筑', duration: '1-2小时',
          desc: '岭南建筑艺术明珠，砖雕、木雕精美绝伦。',
          highlights: ['看砖雕、木雕、灰塑三雕', '赏岭南传统宗祠建筑', '看民间工艺馆藏品'],
          metro: { line: '地铁1/8号线', station: '陈家祠站', walk: '约200米' } },
        { name: '沙面', lat: 23.1080, lng: 113.2430, category: '街区', duration: '1-2小时',
          desc: '欧陆风情历史街区，百年建筑与老树浓荫。',
          highlights: ['看欧式老建筑群', '在老树下散步拍照', '逛教堂与领事馆旧址'],
          metro: { line: '地铁6/8号线', station: '文化公园站', walk: '约400米' } },
        { name: '长隆旅游度假区', lat: 23.0060, lng: 113.3290, category: '乐园', duration: '1天',
          desc: '长隆野生动物世界与欢乐世界，亲子游首选。',
          highlights: ['坐小火车看野生动物', '看大马戏表演', '玩欢乐世界过山车'],
          metro: { line: '地铁3号线', station: '汉溪长隆站', walk: '转接驳车约5分钟' } }
      ],
      foods: [
        { name: '广式早茶', desc: '虾饺、烧卖、凤爪、肠粉，一盅两件叹早茶。' },
        { name: '白切鸡', desc: '皮爽肉滑，蘸姜葱蓉，粤菜经典。' },
        { name: '肠粉', desc: '米浆蒸制，薄滑鲜嫩，浇豉油更香。' },
        { name: '深井烧鹅', desc: '皮脆肉嫩多汁，配酸梅酱解腻。' }
      ],
      tips: '地铁四通八达；珠江夜游可看两岸灯光。'
    },

    '深圳': {
      name: '深圳', province: '广东省', type: 'city', region: '华南',
      lat: 22.5431, lng: 114.0579,
      overview: '年轻活力的创新之城，主题公园、海滨与都市天际线并存。',
      attractions: [
        { name: '世界之窗', lat: 22.5350, lng: 113.9740, category: '乐园', duration: '半天',
          desc: '浓缩全球著名景观的主题公园，一园游世界。',
          highlights: ['看埃菲尔铁塔、金字塔等微缩景观', '看异国风情歌舞表演', '玩动感娱乐项目'],
          metro: { line: '地铁1/2号线', station: '世界之窗站', walk: '约200米' } },
        { name: '欢乐谷', lat: 22.5480, lng: 113.9740, category: '乐园', duration: '1天',
          desc: '大型游乐场，过山车与水上项目刺激过瘾。',
          highlights: ['坐雪域雄鹰、欢乐风火轮等过山车', '玩水上项目（夏季）', '看夜间演艺'],
          metro: { line: '地铁1号线', station: '世界之窗站', walk: '约800米' } },
        { name: '大梅沙海滨公园', lat: 22.6010, lng: 114.3170, category: '海滨', duration: '半天',
          desc: '深圳最热闹的免费海滩，游泳踏浪好去处。',
          highlights: ['下海游泳、踏浪', '沙滩玩沙、看海景', '走海滨栈道'],
          metro: null, get: '地铁8号线盐田路站转公交/假日专线，或打车' },
        { name: '莲花山公园', lat: 22.5480, lng: 114.0590, category: '公园', duration: '2小时',
          desc: '山顶可俯瞰福田 CBD 天际线，登高远眺。',
          highlights: ['登顶看福田CBD天际线', '看邓小平铜像', '在草坪野餐放风筝'],
          metro: { line: '地铁3/4号线', station: '少年宫站', walk: '约500米' } }
      ],
      foods: [
        { name: '海鲜', desc: '盐田海鲜街现捞现做，生猛新鲜。' },
        { name: '椰子鸡', desc: '椰青水煮文昌鸡，清甜滋补。' },
        { name: '广式烧腊', desc: '烧鹅、叉烧、烧肉，街边烧腊店最地道。' }
      ],
      tips: '地铁覆盖主要景点；大梅沙旺季需预约入场。'
    },

    '南京': {
      name: '南京', province: '江苏省', type: 'historic', region: '华东',
      lat: 32.0603, lng: 118.7969,
      overview: '六朝古都、十朝都会，梧桐大道与秦淮河畔尽显金陵气韵。',
      attractions: [
        { name: '中山陵', lat: 32.0600, lng: 118.8480, category: '历史', duration: '2-3小时',
          desc: '孙中山先生陵寝，392级石阶庄严肃穆。',
          highlights: ['登392级石阶谒陵', '看“博爱”“天下为公”牌坊', '俯瞰紫金山风光'],
          metro: { line: '地铁2号线', station: '苜蓿园站', walk: '转景区小火车约10分钟' } },
        { name: '夫子庙·秦淮河', lat: 32.0230, lng: 118.7840, category: '街区', duration: '半天',
          desc: '秦淮灯影、文庙古建，夜游画舫最有意境。',
          highlights: ['乘画舫夜游秦淮河', '逛夫子庙与江南贡院', '吃鸭血粉丝汤等小吃'],
          metro: { line: '地铁3号线', station: '夫子庙站', walk: '约300米' } },
        { name: '总统府', lat: 32.0450, lng: 118.7920, category: '历史', duration: '2小时',
          desc: '近代史重要遗址，中西合璧建筑群。',
          highlights: ['看民国政府旧址与办公楼', '逛煦园江南园林', '看近代史陈列'],
          metro: { line: '地铁2/3号线', station: '大行宫站', walk: '约400米' } },
        { name: '玄武湖', lat: 32.0720, lng: 118.7970, category: '自然', duration: '2小时',
          desc: '城中湖泊，环湖步道与五洲风光宜人。',
          highlights: ['环湖散步或骑行', '乘船游湖', '看五洲与城墙倒影'],
          metro: { line: '地铁1号线', station: '玄武门站', walk: '约500米' } },
        { name: '明孝陵', lat: 32.0580, lng: 118.8510, category: '历史', duration: '2小时',
          desc: '明太祖朱元璋陵寝，神道石象路秋色绝美。',
          highlights: ['走神道看石象路石刻', '看方城明楼与宝顶', '秋季赏银杏与枫叶'],
          metro: { line: '地铁2号线', station: '苜蓿园站', walk: '转景区接驳约10分钟' } }
      ],
      foods: [
        { name: '盐水鸭', desc: '桂花鸭，皮白肉嫩，咸香清爽。' },
        { name: '鸭血粉丝汤', desc: '鸭血、鸭肠、粉丝，汤鲜味浓。' },
        { name: '牛肉锅贴', desc: '外皮金黄酥脆，肉馅多汁。' },
        { name: '小笼包', desc: '金陵汤包，皮薄汁足。' }
      ],
      tips: '中山陵需预约；秦淮河夜游建议傍晚前往。'
    },

    '武汉': {
      name: '武汉', province: '湖北省', type: 'city', region: '华中',
      lat: 30.5928, lng: 114.3055,
      overview: '九省通衢、江城武汉，长江与汉江交汇，黄鹤楼与热干面名声在外。',
      attractions: [
        { name: '黄鹤楼', lat: 30.5470, lng: 114.3050, category: '地标', duration: '2小时',
          desc: '“天下江山第一楼”，登楼可望长江与武汉三镇。',
          highlights: ['登楼看长江与武汉长江大桥', '看历代黄鹤楼模型', '赏诗词碑刻'],
          metro: { line: '地铁5号线', station: '司门口黄鹤楼站', walk: '约600米' } },
        { name: '东湖风景区', lat: 30.5590, lng: 114.4100, category: '自然', duration: '半天',
          desc: '城中大湖，绿道骑行、樱园赏花，四季皆宜。',
          highlights: ['沿东湖绿道骑行', '春季在磨山樱园赏樱', '乘船游湖'],
          metro: { line: '地铁8号线', station: '梨园站', walk: '约800米' } },
        { name: '户部巷', lat: 30.5490, lng: 114.2980, category: '街区', duration: '1-2小时',
          desc: '汉味小吃一条街，热干面、豆皮、糊汤粉。',
          highlights: ['吃热干面、三鲜豆皮', '尝糊汤粉、糊米酒', '逛老武昌街巷'],
          metro: { line: '地铁5号线', station: '司门口黄鹤楼站', walk: '约700米' } },
        { name: '江汉路步行街', lat: 30.5820, lng: 114.2930, category: '街区', duration: '2小时',
          desc: '百年商业街，欧式老建筑林立，夜景热闹。',
          highlights: ['看欧式历史建筑', '逛街购物吃小吃', '看江滩与夜景'],
          metro: { line: '地铁2/6号线', station: '江汉路站', walk: '约200米' } }
      ],
      foods: [
        { name: '热干面', desc: '芝麻酱拌碱水面，武汉人的早餐灵魂。' },
        { name: '周黑鸭/精武鸭脖', desc: '麻辣卤味，追剧夜宵好伴侣。' },
        { name: '三鲜豆皮', desc: '糯米豆皮包鲜肉香菇，外脆内软。' },
        { name: '糊汤粉', desc: '鱼糊汤配米粉，鲜辣暖胃。' }
      ],
      tips: '武汉三镇分散，跨江可乘地铁或轮渡。'
    },

    '厦门': {
      name: '厦门', province: '福建省', type: 'coastal', region: '华东',
      lat: 24.4798, lng: 118.0894,
      overview: '海上花园城市，鼓浪屿琴声、环岛路海风与文艺小巷，浪漫悠闲。',
      attractions: [
        { name: '鼓浪屿', lat: 24.4470, lng: 118.0620, category: '海岛', duration: '1天',
          desc: '万国建筑博物馆，日光岩、菽庄花园，需乘轮渡上岛。',
          highlights: ['登日光岩俯瞰全岛', '逛菽庄花园与钢琴博物馆', '走街串巷看万国建筑'],
          metro: null, get: '地铁1号线镇海路站步行至轮渡码头，乘船前往（需提前购票）' },
        { name: '厦门大学', lat: 24.4380, lng: 118.1010, category: '校园', duration: '2小时',
          desc: '依山傍海的美丽校园，芙蓉隧道涂鸦墙是网红打卡点。',
          highlights: ['看芙蓉隧道涂鸦墙', '逛上弦场与嘉庚建筑', '在白城沙滩看海'],
          metro: null, get: '公交1/21/45路直达，或打车' },
        { name: '南普陀寺', lat: 24.4430, lng: 118.0950, category: '寺庙', duration: '1-2小时',
          desc: '闽南名刹，紧邻厦大，可登五老峰看海。',
          highlights: ['参拜天王殿、大悲殿', '登五老峰俯瞰厦大与海', '吃素斋'],
          metro: null, get: '公交1/21路，与厦门大学相邻' },
        { name: '曾厝垵', lat: 24.4280, lng: 118.1280, category: '街区', duration: '2小时',
          desc: '环岛路旁的小渔村，文艺小店与小吃云集。',
          highlights: ['逛文艺小店与客栈', '吃沙茶面、海蛎煎', '到环岛路骑行看海'],
          metro: null, get: '公交29/47路，环岛路旁' },
        { name: '中山路步行街', lat: 24.4560, lng: 118.0820, category: '街区', duration: '2小时',
          desc: '骑楼老街，闽南小吃与伴手礼集中地。',
          highlights: ['看骑楼建筑群', '买花生酥等伴手礼', '吃厦门小吃'],
          metro: { line: '地铁1号线', station: '镇海路站', walk: '约600米' } }
      ],
      foods: [
        { name: '沙茶面', desc: '沙茶汤底配海鲜、豆腐，浓郁鲜香。' },
        { name: '海蛎煎', desc: '新鲜海蛎配蛋液煎制，外酥里嫩。' },
        { name: '土笋冻', desc: '星虫熬制的胶冻，蘸芥末酱油，清甜Q弹。' },
        { name: '花生汤', desc: '花生熬煮浓汤，加蛋更香，配油条最佳。' }
      ],
      tips: '鼓浪屿船票需提前在官网/公众号预约；岛上靠步行，穿舒适鞋。'
    },

    '青岛': {
      name: '青岛', province: '山东省', type: 'coastal', region: '华东',
      lat: 36.0671, lng: 120.3826,
      overview: '红瓦绿树、碧海蓝天的啤酒之城，海滨栈桥与德式老建筑别具风情。',
      attractions: [
        { name: '栈桥', lat: 36.0600, lng: 120.3200, category: '地标', duration: '1小时',
          desc: '青岛标志，回澜阁伸入海中，海鸥盘旋。',
          highlights: ['走到回澜阁看海', '冬季喂海鸥', '看小青岛与军舰'],
          metro: { line: '地铁1/3号线', station: '青岛站', walk: '约400米' } },
        { name: '八大关', lat: 36.0560, lng: 120.3520, category: '街区', duration: '2小时',
          desc: '红瓦绿树间遍布各国风格别墅，婚纱照圣地。',
          highlights: ['看各国风格老别墅', '在花石楼、公主楼拍照', '秋赏落叶、海边散步'],
          metro: { line: '地铁3号线', station: '中山公园站', walk: '约900米' } },
        { name: '崂山', lat: 36.1900, lng: 120.6200, category: '自然', duration: '1天',
          desc: '海上第一名山，道教名山，山海相连景色壮阔。',
          highlights: ['登巨峰看海天一色', '逛太清宫道教宫观', '看潮音瀑与北九水'],
          metro: null, get: '地铁11号线北九水站，或打车约1小时' },
        { name: '五四广场', lat: 36.0650, lng: 120.3820, category: '地标', duration: '1小时',
          desc: '“五月的风”雕塑与奥帆中心相邻，看海好去处。',
          highlights: ['打卡“五月的风”雕塑', '看奥帆中心与浮山湾', '沿海边步道散步'],
          metro: { line: '地铁2/3号线', station: '五四广场站', walk: '约200米' } },
        { name: '青岛啤酒博物馆', lat: 36.0780, lng: 120.3490, category: '博物馆', duration: '2小时',
          desc: '百年青啤发源地，可品鉴原浆啤酒。',
          highlights: ['看百年老厂房与生产线', '品原浆啤酒', '了解啤酒酿造工艺'],
          metro: { line: '地铁2号线', station: '利津路站', walk: '约600米' } }
      ],
      foods: [
        { name: '青岛啤酒', desc: '原浆扎啤清爽，配海鲜最地道。' },
        { name: '海鲜', desc: '蛤蜊、海螺、螃蟹，辣炒蛤蜊是招牌。' },
        { name: '锅贴', desc: '皮脆馅鲜，海鲜锅贴别有风味。' },
        { name: '脂渣', desc: '五花肉炼油后的香脆小吃。' }
      ],
      tips: '夏季海滨紫外线强，注意防晒；啤酒节期间住宿紧张需提前订。'
    },

    '三亚': {
      name: '三亚', province: '海南省', type: 'beach', region: '华南',
      lat: 18.2528, lng: 109.5119,
      overview: '热带滨海度假胜地，碧海白沙、椰风海韵，冬季避寒首选。',
      attractions: [
        { name: '亚龙湾', lat: 18.2130, lng: 109.6500, category: '海滩', duration: '半天',
          desc: '“天下第一湾”，海水清澈、沙滩细腻，适合游泳潜水。',
          highlights: ['下海游泳、玩沙滩', '体验浮潜、摩托艇等水上项目', '在椰林下晒太阳'],
          metro: null, get: '市区乘公交15/25路，或打车约40分钟' },
        { name: '天涯海角', lat: 18.2960, lng: 109.3530, category: '地标', duration: '2小时',
          desc: '“天涯”“海角”巨石，浪漫的地标打卡点。',
          highlights: ['打卡“天涯”“海角”巨石', '看南天一柱', '沿海边栈道散步'],
          metro: null, get: '公交16/25/57路' },
        { name: '蜈支洲岛', lat: 18.3180, lng: 109.7660, category: '海岛', duration: '1天',
          desc: '潜水胜地，海水能见度高，可玩水上项目。',
          highlights: ['体验深潜/浮潜看珊瑚', '玩香蕉船、拖伞等水上项目', '环岛电瓶车看海景'],
          metro: null, get: '乘船登岛，需提前购票' },
        { name: '大东海', lat: 18.2170, lng: 109.5150, category: '海滩', duration: '半天',
          desc: '市区附近的开放海滩，餐饮配套齐全。',
          highlights: ['游泳、晒太阳', '沿海边酒吧街休闲', '吃海鲜'],
          metro: null, get: '公交2/4/8路' },
        { name: '南山文化旅游区', lat: 18.2960, lng: 109.2010, category: '文化', duration: '半天',
          desc: '108米海上观音像，佛教文化园区。',
          highlights: ['瞻仰108米海上观音', '逛南山寺与不二法门', '吃素斋'],
          metro: null, get: '公交16/25路或旅游专线' }
      ],
      foods: [
        { name: '海鲜', desc: '第一市场选购后加工，或海鲜餐厅现点。' },
        { name: '椰子饭', desc: '椰肉糯米蒸制，清甜椰香。' },
        { name: '文昌鸡', desc: '海南四大名菜之一，皮薄肉嫩。' },
        { name: '清补凉', desc: '椰奶配红豆、薏米、水果，消暑甜品。' }
      ],
      tips: '紫外线强烈，务必防晒；旺季机票住宿紧张，建议提前预订。'
    },

    '丽江': {
      name: '丽江', province: '云南省', type: 'oldtown', region: '西南',
      lat: 26.8721, lng: 100.2299,
      overview: '纳西族古城，雪山古城、茶马古道，慢节奏的文艺与民族风情。',
      attractions: [
        { name: '丽江古城', lat: 26.8721, lng: 100.2299, category: '古城', duration: '半天',
          desc: '世界文化遗产，四方街、木府、小桥流水人家。',
          highlights: ['逛四方街与木府', '走小桥流水古巷', '在酒吧街听民谣'],
          metro: null, get: '机场/火车站打车约20-30分钟' },
        { name: '玉龙雪山', lat: 27.0980, lng: 100.1750, category: '雪山', duration: '1天',
          desc: '纳西族神山，冰川公园与蓝月谷，缆车登顶壮观。',
          highlights: ['坐大索道上冰川公园', '看蓝月谷的碧蓝湖水', '看《印象丽江》演出'],
          metro: null, get: '古城出发包车/拼车约40分钟，需提前购票' },
        { name: '束河古镇', lat: 26.9230, lng: 100.2090, category: '古镇', duration: '2-3小时',
          desc: '比大研古城更安静，纳西民居与马帮文化。',
          highlights: ['逛青龙桥与四方街', '看茶马古道博物馆', '在安静院落喝茶'],
          metro: null, get: '古城打车约10分钟' },
        { name: '拉市海', lat: 26.8600, lng: 100.1600, category: '自然', duration: '半天',
          desc: '高原湿地，骑马、划船，冬季可观候鸟。',
          highlights: ['骑马走茶马古道', '划船游湿地', '冬季看候鸟'],
          metro: null, get: '古城打车约20分钟' },
        { name: '泸沽湖', lat: 27.7200, lng: 100.7600, category: '湖泊', duration: '1-2天',
          desc: '摩梭人“女儿国”，湖水湛蓝，走婚桥与草海。',
          highlights: ['环湖看里格半岛与情人滩', '走婚桥看草海', '乘猪槽船游湖'],
          metro: null, get: '丽江乘车约3-4小时，建议包车或跟团' }
      ],
      foods: [
        { name: '腊排骨火锅', desc: '纳西族传统，腊排骨炖汤，鲜香浓郁。' },
        { name: '鸡豆凉粉', desc: '丽江特产鸡豆制成，酸辣爽口。' },
        { name: '纳西烤鱼', desc: '炭火烤鱼，外焦里嫩。' },
        { name: '鲜花饼', desc: '玫瑰花瓣入馅，香甜酥软。' }
      ],
      tips: '丽江海拔约2400米，注意高反与防晒；玉龙雪山需提前购票。'
    },

    '大理': {
      name: '大理', province: '云南省', type: 'oldtown', region: '西南',
      lat: 25.6065, lng: 100.2676,
      overview: '风花雪月之地，苍山洱海之间，白族风情与田园风光令人心旷神怡。',
      attractions: [
        { name: '大理古城', lat: 25.6930, lng: 100.1620, category: '古城', duration: '半天',
          desc: '南诏国都，五华楼、人民路，闲适文艺。',
          highlights: ['逛五华楼与复兴路', '在人民路逛小店、泡咖啡馆', '看白族扎染'],
          metro: null, get: '火车站/机场打车约30分钟' },
        { name: '洱海', lat: 25.7520, lng: 100.1880, category: '湖泊', duration: '1天',
          desc: '环洱海骑行，双廊、喜洲、小普陀沿岸风光。',
          highlights: ['环洱海骑行/自驾', '在双廊、小普陀看海', '住海景民宿看日落'],
          metro: null, get: '古城租电动车/包车环湖' },
        { name: '苍山', lat: 25.6800, lng: 100.1000, category: '山', duration: '半天',
          desc: '洗马潭索道登顶，俯瞰洱海全景。',
          highlights: ['坐洗马潭索道登顶', '俯瞰洱海与古城', '走玉带云游路'],
          metro: null, get: '古城打车至索道下站约10分钟' },
        { name: '崇圣寺三塔', lat: 25.7050, lng: 100.1480, category: '历史', duration: '2小时',
          desc: '大理标志性建筑，三塔倒影是经典画面。',
          highlights: ['看三塔倒影', '逛崇圣寺佛教建筑群', '了解南诏大理国历史'],
          metro: null, get: '古城步行/打车约15分钟' },
        { name: '喜洲古镇', lat: 25.8550, lng: 100.1260, category: '古镇', duration: '2-3小时',
          desc: '白族民居与稻田风光，喜洲粑粑闻名。',
          highlights: ['看白族三坊一照壁民居', '吃喜洲破酥粑粑', '在稻田边拍照'],
          metro: null, get: '古城乘车约30分钟' }
      ],
      foods: [
        { name: '乳扇', desc: '牛奶制成的白族小吃，可炸可烤，奶香浓郁。' },
        { name: '酸辣鱼', desc: '洱海鱼配酸辣汤，开胃下饭。' },
        { name: '喜洲破酥粑粑', desc: '炭火烤制的酥脆饼，甜咸两味。' },
        { name: '饵丝', desc: '米制细条，配肉臊或焖肉，爽滑。' }
      ],
      tips: '环洱海约120公里，建议租车或包车；洱海生态廊道禁止机动车。'
    },

    '桂林': {
      name: '桂林', province: '广西壮族自治区', type: 'mountain', region: '华南',
      lat: 25.2736, lng: 110.2900,
      overview: '“桂林山水甲天下”，喀斯特峰林与漓江碧水，如诗如画。',
      attractions: [
        { name: '漓江', lat: 25.0700, lng: 110.4200, category: '自然', duration: '1天',
          desc: '乘船或竹筏游漓江，九马画山、黄布倒影。',
          highlights: ['坐游船/竹筏看九马画山', '看20元人民币背景黄布倒影', '赏兴坪段峰林'],
          metro: null, get: '磨盘山/竹江码头乘船，或兴坪乘竹筏' },
        { name: '阳朔西街', lat: 24.7780, lng: 110.4960, category: '街区', duration: '2小时',
          desc: '中西合璧的老街，啤酒鱼与酒吧夜生活。',
          highlights: ['吃啤酒鱼', '逛老店与酒吧街', '租电动车游遇龙河'],
          metro: null, get: '桂林乘船/大巴约1.5小时' },
        { name: '象鼻山', lat: 25.2730, lng: 110.2930, category: '地标', duration: '1-2小时',
          desc: '桂林城徽，形似巨象饮水，可登岛观景。',
          highlights: ['拍象鼻山经典倒影', '登象山看市区', '看爱情岛与三花酒窖'],
          metro: null, get: '市区公交/步行可达' },
        { name: '龙脊梯田', lat: 25.7500, lng: 110.1350, category: '自然', duration: '1天',
          desc: '层层叠叠的梯田，金秋稻浪与晨雾云海绝美。',
          highlights: ['看金坑大寨梯田', '在平安寨看“七星伴月”', '看日出云海'],
          metro: null, get: '桂林/阳朔乘车约2小时' },
        { name: '两江四湖', lat: 25.2730, lng: 110.2900, category: '夜景', duration: '2小时',
          desc: '夜游环城水系，日月双塔灯光璀璨。',
          highlights: ['乘船夜游', '看日月双塔灯光', '赏沿湖夜景'],
          metro: null, get: '市区步行，夜游码头在市区' }
      ],
      foods: [
        { name: '桂林米粉', desc: '卤菜粉配锅烧、酸豆角，干拌最地道。' },
        { name: '啤酒鱼', desc: '漓江鱼配啤酒番茄焖煮，鲜嫩入味。' },
        { name: '荔浦芋扣肉', desc: '荔浦芋头夹五花肉，软糯香浓。' }
      ],
      tips: '桂林到阳朔可乘船或大巴；夏季多雨，备好雨具。'
    },

    '苏州': {
      name: '苏州', province: '江苏省', type: 'city', region: '华东',
      lat: 31.2989, lng: 120.5853,
      overview: '园林之城、水乡古镇，小桥流水与昆曲评弹，尽显江南风雅。',
      attractions: [
        { name: '拙政园', lat: 31.3230, lng: 120.6290, category: '园林', duration: '2-3小时',
          desc: '中国四大名园之一，亭台楼阁、水榭回廊。',
          highlights: ['看远香堂与荷塘', '逛水廊与假山', '赏四季花木'],
          metro: { line: '地铁6号线', station: '拙政园苏博站', walk: '约300米' } },
        { name: '苏州博物馆', lat: 31.3250, lng: 120.6310, category: '博物馆', duration: '2小时',
          desc: '贝聿铭封山之作，白墙黛瓦的现代水墨。',
          highlights: ['看贝聿铭设计的建筑', '赏片石假山与庭院', '看吴地文物'],
          metro: { line: '地铁6号线', station: '拙政园苏博站', walk: '约300米' } },
        { name: '虎丘', lat: 31.3400, lng: 120.5780, category: '历史', duration: '2小时',
          desc: '“到苏州不游虎丘乃憾事”，云岩寺塔千年斜塔。',
          highlights: ['看千年云岩寺斜塔', '逛剑池与试剑石', '听吴王阖闾的传说'],
          metro: { line: '地铁2号线', station: '山塘街站', walk: '转公交/步行约15分钟' } },
        { name: '平江路', lat: 31.3110, lng: 120.6300, category: '街区', duration: '2小时',
          desc: '沿河历史街区，评弹茶馆与小桥流水。',
          highlights: ['坐摇橹船听评弹', '逛沿河老宅与文创店', '吃苏式点心'],
          metro: { line: '地铁1号线', station: '临顿路站', walk: '约400米' } },
        { name: '周庄古镇', lat: 31.1130, lng: 120.8450, category: '古镇', duration: '半天',
          desc: '中国第一水乡，双桥、沈厅，摇橹船游古镇。',
          highlights: ['看双桥与沈厅、张厅', '乘摇橹船游水巷', '吃万三蹄'],
          metro: null, get: '苏州乘大巴约1小时，或自驾' }
      ],
      foods: [
        { name: '松鼠桂鱼', desc: '花刀炸制的桂鱼浇酸甜汁，外酥里嫩。' },
        { name: '苏式汤面', desc: '细面配焖肉、爆鱼浇头，汤清味鲜。' },
        { name: '糖粥', desc: '赤豆糊配糯米粥，甜而不腻。' },
        { name: '碧螺虾仁', desc: '碧螺春茶香炒河虾仁，清鲜雅致。' }
      ],
      tips: '园林多需预约；古城内步行或骑行最方便。'
    },

    '长沙': {
      name: '长沙', province: '湖南省', type: 'city', region: '华中',
      lat: 28.2282, lng: 112.9388,
      overview: '网红之城、美食不夜城，岳麓山、橘子洲与湘菜的火辣热情。',
      attractions: [
        { name: '橘子洲', lat: 28.1910, lng: 112.9540, category: '地标', duration: '2小时',
          desc: '湘江中的长岛，青年毛泽东雕像，烟花与夜景。',
          highlights: ['看青年毛泽东雕像', '沿江散步看湘江夜景', '坐小火车环岛'],
          metro: { line: '地铁2号线', station: '橘子洲站', walk: '约200米' } },
        { name: '岳麓山', lat: 28.1810, lng: 112.9340, category: '自然', duration: '半天',
          desc: '爱晚亭、岳麓书院，秋赏红枫，人文荟萃。',
          highlights: ['看爱晚亭与岳麓书院', '秋赏满山红枫', '登顶看湘江与城市'],
          metro: { line: '地铁4号线', station: '湖南大学站', walk: '约600米' } },
        { name: '太平街', lat: 28.1940, lng: 112.9700, category: '街区', duration: '2小时',
          desc: '千年老街，臭豆腐、茶颜悦色、文和友。',
          highlights: ['吃臭豆腐、糖油粑粑', '喝茶颜悦色', '逛文和友复古街区'],
          metro: { line: '地铁1号线', station: '黄兴广场站', walk: '约400米' } },
        { name: '湖南省博物馆', lat: 28.2160, lng: 112.9890, category: '博物馆', duration: '2-3小时',
          desc: '马王堆汉墓出土文物，辛追夫人与素纱襌衣。',
          highlights: ['看马王堆汉墓陈列', '看辛追夫人与素纱襌衣', '了解汉代文明'],
          metro: { line: '地铁1号线', station: '文昌阁站', walk: '约800米' } }
      ],
      foods: [
        { name: '臭豆腐', desc: '外焦里嫩，浇辣椒蒜汁，闻着臭吃着香。' },
        { name: '口味虾', desc: '麻辣小龙虾，夜宵界的顶流。' },
        { name: '剁椒鱼头', desc: '鲜辣入味，湘菜代表作。' },
        { name: '茶颜悦色', desc: '长沙本土新式茶饮，幽兰拿铁必点。' }
      ],
      tips: '橘子洲周末烟花需关注公告；热门餐厅饭点需排队。'
    },

    '哈尔滨': {
      name: '哈尔滨', province: '黑龙江省', type: 'city', region: '东北',
      lat: 45.8038, lng: 126.5349,
      overview: '冰城夏都，欧式建筑与冰雪文化交融，冬季冰雪大世界举世闻名。',
      attractions: [
        { name: '中央大街', lat: 45.7700, lng: 126.6170, category: '街区', duration: '2小时',
          desc: '百年面包石大街，俄式建筑与马迭尔冰棍。',
          highlights: ['走面包石大街看俄式建筑', '吃马迭尔冰棍', '买红肠等伴手礼'],
          metro: { line: '地铁2号线', station: '中央大街站', walk: '约300米' } },
        { name: '圣索菲亚教堂', lat: 45.7680, lng: 126.6160, category: '建筑', duration: '1小时',
          desc: '拜占庭式东正教堂，洋葱头穹顶，哈尔滨地标。',
          highlights: ['拍洋葱头穹顶', '看内部壁画与展览', '在广场喂鸽子'],
          metro: { line: '地铁2号线', station: '中央大街站', walk: '约500米' } },
        { name: '冰雪大世界', lat: 45.7780, lng: 126.5600, category: '乐园', duration: '半天',
          desc: '冬季限定的冰雕雪雕王国，夜晚灯光梦幻。',
          highlights: ['看巨型冰雕雪雕', '玩冰滑梯与雪圈', '看夜间灯光秀'],
          metro: { line: '地铁2号线', station: '冰雪大世界站', walk: '约500米' } },
        { name: '太阳岛', lat: 45.7950, lng: 126.5980, category: '公园', duration: '半天',
          desc: '松花江北岸的风景区，夏季避暑、冬季雪博会。',
          highlights: ['看雪博会（冬季）', '夏季逛湿地与花海', '坐观光车游园'],
          metro: { line: '地铁2号线', station: '太阳岛站', walk: '约600米' } }
      ],
      foods: [
        { name: '哈尔滨红肠', desc: '蒜香浓郁，烟熏风味，秋林里道斯最出名。' },
        { name: '锅包肉', desc: '外酥里嫩，酸甜口，东北名菜。' },
        { name: '马迭尔冰棍', desc: '百年老字号，奶香浓郁，冬天吃更带感。' },
        { name: '大列巴', desc: '俄式大面包，麦香十足，配红肠吃。' }
      ],
      tips: '冬季气温低，务必做好保暖；冰雪大世界夜场更美，注意防滑。'
    },

    '拉萨': {
      name: '拉萨', province: '西藏自治区', type: 'mountain', region: '西南',
      lat: 29.6520, lng: 91.1721,
      overview: '日光之城、雪域圣城，布达拉宫与大昭寺是藏文化的灵魂。',
      attractions: [
        { name: '布达拉宫', lat: 29.6579, lng: 91.1173, category: '历史', duration: '半天',
          desc: '世界上海拔最高的宫殿，藏传佛教圣地，需提前预约。',
          highlights: ['看红宫白宫与金顶', '看历代达赖灵塔与壁画', '登顶俯瞰拉萨城'],
          metro: null, get: '市区步行/打车，需提前预约' },
        { name: '大昭寺', lat: 29.6530, lng: 91.1320, category: '寺庙', duration: '2小时',
          desc: '藏传佛教信徒朝拜的中心，释迦牟尼12岁等身像。',
          highlights: ['看释迦牟尼12岁等身像', '看金顶与转经道', '感受虔诚朝拜氛围'],
          metro: null, get: '市区步行可达' },
        { name: '八廓街', lat: 29.6540, lng: 91.1320, category: '街区', duration: '2小时',
          desc: '围绕大昭寺的转经道，藏式小店与甜茶馆。',
          highlights: ['跟着人流转经', '逛藏式小店买纪念品', '喝甜茶、吃藏面'],
          metro: null, get: '市区步行可达' },
        { name: '纳木错', lat: 30.7700, lng: 90.8800, category: '湖泊', duration: '1天',
          desc: '西藏三大圣湖之一，天湖湛蓝，雪山环抱。',
          highlights: ['看湛蓝湖面与念青唐古拉雪山', '在湖边拍倒影', '感受高原圣湖的辽阔'],
          metro: null, get: '拉萨包车/跟团约3小时' },
        { name: '色拉寺', lat: 29.6990, lng: 91.1340, category: '寺庙', duration: '2小时',
          desc: '可看辩经，藏传佛教格鲁派六大寺之一。',
          highlights: ['看僧人辩经（下午）', '看措钦大殿壁画', '逛后山岩画'],
          metro: null, get: '市区公交/打车约20分钟' }
      ],
      foods: [
        { name: '藏面', desc: '牦牛骨汤配青稞面条，清淡暖胃。' },
        { name: '酥油茶', desc: '酥油、砖茶、盐打制，抵御高反的传统饮品。' },
        { name: '糌粑', desc: '青稞炒面，配酥油茶捏食。' },
        { name: '牦牛肉', desc: '风干或炖煮，高蛋白、耐饿。' }
      ],
      tips: '海拔约3650米，注意高反、避免剧烈运动；进藏前可先适应几天。'
    }
  };

  var ALIASES = {
    '京城': '北京', '首都': '北京',
    '魔都': '上海', '沪': '上海',
    '蓉城': '成都', '锦官城': '成都',
    '山城': '重庆', '渝': '重庆',
    '长安': '西安',
    '羊城': '广州', '穗': '广州',
    '鹏城': '深圳',
    '金陵': '南京',
    '江城': '武汉',
    '鹭岛': '厦门',
    '鹿城': '三亚', '天涯': '三亚',
    '姑苏': '苏州',
    '星城': '长沙',
    '冰城': '哈尔滨',
    '日光城': '拉萨',
    // 景区 / 自治州 / 别名 → 地级行政区
    '吉林': '吉林市',
    '大理州': '大理',
    '平遥': '晋中', '平遥古城': '晋中',
    '曲阜': '济宁',
    '泰山': '泰安',
    '峨眉山': '乐山',
    '敦煌': '酒泉', '莫高窟': '酒泉',
    '香格里拉': '迪庆', '迪庆州': '迪庆',
    '九寨沟': '阿坝', '阿坝州': '阿坝',
    '稻城': '甘孜', '稻城亚丁': '甘孜', '甘孜州': '甘孜',
    '泸沽湖': '丽江',
    '凉山州': '凉山', '西昌': '凉山',
    '延边州': '延边', '长白山': '延边',
    '黔东南州': '黔东南', '千户苗寨': '黔东南', '西江': '黔东南',
    '黔南州': '黔南', '荔波': '黔南',
    '黔西南州': '黔西南', '万峰林': '黔西南', '兴义': '黔西南',
    '湘西州': '湘西', '凤凰': '湘西', '凤凰古城': '湘西',
    '红河州': '红河', '元阳': '红河',
    '西双版纳州': '西双版纳', '景洪': '西双版纳',
    '阿尔山': '兴安盟', '兴安': '兴安盟',
    '锡林郭勒': '锡林郭勒盟',
    '阿拉善': '阿拉善盟',
    '漠河': '大兴安岭', '北极村': '大兴安岭',
    '甘南州': '甘南',
    '茶卡': '海西', '茶卡盐湖': '海西', '海西州': '海西',
    '青海湖': '海北', '海北州': '海北',
    '库尔勒': '巴音郭楞',
    '赛里木湖': '博尔塔拉',
    '武夷山': '南平',
    '婺源': '上饶',
    '黄果树': '安顺',
    '腾冲': '保山',
    '九华山': '池州',
    '普陀山': '舟山',
    '武当山': '十堰',
    '五台山': '忻州',
    '华山': '渭南',
    '喀纳斯': '阿勒泰', '禾木': '阿勒泰'
  };

  function normalizeCity(name) {
    if (!name) return '';
    var s = String(name).trim();
    s = s.replace(/(市|省|自治区|特别行政区|地区)$/, '');
    return s;
  }

  function lookupAll() {
    return {
      db: DB,
      rich: global.CITY_RICH || {},
      extra: global.CITY_EXTRA || {}
    };
  }

  function cityDataByKey(key) {
    var all = lookupAll();
    return all.db[key] || all.rich[key] || all.extra[key] || null;
  }

  /** 小景点 → 合并所属城市信息，生成完整目的地对象 */
  function makeScenicDestination(key, sc) {
    var parent = cityDataByKey(sc.parent);
    var data = {
      name: sc.name,
      province: parent ? parent.province : '',
      region: parent ? parent.region : '华东',
      type: parent ? parent.type : 'mountain',
      lat: sc.lat, lng: sc.lng,
      overview: sc.desc,
      foods: parent ? parent.foods : [],
      tips: (sc.get ? '前往：' + sc.get : '') + (parent && parent.tips ? '。' + parent.tips : ''),
      attractions: [{
        name: sc.name, lat: sc.lat, lng: sc.lng,
        category: sc.category, duration: sc.duration,
        desc: sc.desc, highlights: sc.highlights,
        metro: null, get: sc.get
      }],
      parent: sc.parent,
      parentLat: parent ? parent.lat : null,
      parentLng: parent ? parent.lng : null,
      scenic: true
    };
    return { key: sc.name, data: data, curated: true, scenic: true };
  }

  function findDestination(name) {
    var key = normalizeCity(name);

    // 1) 小景点（精确，含别名）
    var scKey = key;
    if (global.SCENIC_ALIASES && global.SCENIC_ALIASES[scKey]) scKey = global.SCENIC_ALIASES[scKey];
    if (global.SCENIC && global.SCENIC[scKey]) {
      return makeScenicDestination(scKey, global.SCENIC[scKey]);
    }

    // Scenic aliases may intentionally resolve to a city destination.
    key = scKey;
    // 2) 城市（含别名）
    if (ALIASES[key]) key = ALIASES[key];
    var all = lookupAll();
    if (all.db[key]) return { key: key, data: all.db[key], curated: true };
    if (all.rich[key]) return { key: key, data: all.rich[key], curated: true };
    if (all.extra[key]) return { key: key, data: all.extra[key], curated: false };

    // 3) 模糊匹配（城市 + 小景点，仅当前缀命中唯一时）
    var cand = [];
    [all.db, all.rich, all.extra, (global.SCENIC || {})].forEach(function (src) {
      Object.keys(src).forEach(function (k) {
        if (key && (k.indexOf(key) === 0 || key.indexOf(k) === 0)) cand.push(k);
      });
    });
    var uniq = cand.filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (uniq.length === 1) {
      var ck = uniq[0];
      if (all.db[ck]) return { key: ck, data: all.db[ck], curated: true };
      if (all.rich[ck]) return { key: ck, data: all.rich[ck], curated: true };
      if (all.extra[ck]) return { key: ck, data: all.extra[ck], curated: false };
      if (global.SCENIC && global.SCENIC[ck]) return makeScenicDestination(ck, global.SCENIC[ck]);
    }
    return null;
  }

  global.DEST_DB = DB;
  global.findDestination = findDestination;
  global.normalizeCity = normalizeCity;
})(window);
