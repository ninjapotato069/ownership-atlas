// Guided stories. Each step sets the year, highlights nodes and shows a caption.
module.exports = [
{id:"crisis2008",title:"2008: the year the giants fell",blurb:"How sovereign funds, central banks and governments ended up owning Wall Street and the City in twelve months.",steps:[
 {y:2007,cap:"Late 2007: as subprime losses mount, Gulf and Asian sovereign funds put about $40B into Citigroup, UBS, Merrill Lynch and Morgan Stanley.",focus:["adia","citi","gic","ubs","temasek","merrill","cic","ms","kia_fund"]},
 {y:2008,cap:"March 2008: Bear Stearns runs out of funding and is sold to JPMorgan for $10 a share, backed by a $29B Federal Reserve loan.",focus:["jpm","bearstearns"]},
 {y:2008,cap:"15 September 2008: Lehman Brothers files for bankruptcy. The same weekend Merrill Lynch sells itself to Bank of America, which already owns Countrywide.",focus:["lehman","barclays","bofa","merrill","countrywide"]},
 {y:2008,cap:"Days later the US takes 79.9% of AIG. WaMu fails and goes to JPMorgan; Wachovia goes to Wells Fargo. Berkshire and MUFG prop up Goldman Sachs and Morgan Stanley.",focus:["gov_us","aig","wamu","wachovia","wells","jpm","berkshire","gs","mufg","ms"]},
 {y:2008,cap:"October 2008: Britain takes 84% of RBS and backs Lloyds' rescue of HBOS; the Dutch state takes ABN AMRO; Fortis is broken up; Switzerland rescues UBS.",focus:["gov_uk","rbs","lloyds","hbos","northernrock","gov_nl","abnamro","fortis","bnp","gov_ch","ubs"]},
 {y:2009,cap:"2009: GM and Chrysler go through bankruptcy and the US Treasury ends up owning 60.8% of GM. Germany takes 25% of Commerzbank, which has just bought Dresdner.",focus:["gm","chrysler","gov_us","fiat","gov_de","commerzbank","dresdner","allianz"]},
 {y:2013,cap:"Aftermath: governments sold out over the next decade, AIG in 2012, GM in 2013 and Lloyds in 2017. Britain only finished selling NatWest (ex-RBS) in 2025.",focus:["gov_us","gov_uk","aig","gm","lloyds","rbs"]}
]},
{id:"indiabanks",title:"India's banks: from 27 state banks to 12",blurb:"Nationalisation, liberalisation, failures and mergers: how Indian banking was rebuilt, and who is buying in now.",steps:[
 {y:1955,cap:"1955: the government takes over the Imperial Bank of India, whose roots go back to the Bank of Calcutta (1806), and renames it State Bank of India.",focus:["gov_in","sbi"]},
 {y:1969,cap:"19 July 1969: 14 large private banks are nationalised overnight. Six more follow in April 1980.",focus:["gov_in","pnb","bob","canara","union","boi","indianbank","centralbank","iob","uco","bom","ubi","dena","syndicate","allahabad"]},
 {y:1994,cap:"1993–94: New Bank of India merges into PNB, and the RBI licenses a new generation of private banks: HDFC Bank, ICICI Bank, UTI Bank (now Axis), IndusInd, Global Trust and Times Bank.",focus:["newbank","pnb","hdfcbank","icicibank","axis","indusind","gtb","timesbank","hdfc","icici"]},
 {y:2004,cap:"2004: Global Trust Bank collapses under bad loans and is merged into Oriental Bank of Commerce within days.",focus:["gtb","obc","rbi"]},
 {y:2017,cap:"1 April 2017: SBI absorbs its five associate banks and Bharatiya Mahila Bank, becoming one of the world's 50 largest banks.",focus:["sbi","sbbj","sbh","sbm","sbp","sbt","bmb","sbs","sbindore"]},
 {y:2019,cap:"April 2019: Vijaya Bank and Dena Bank merge into Bank of Baroda, India's first three-way bank merger.",focus:["bob","vijaya","dena"]},
 {y:2020,cap:"1 April 2020: ten banks become four. OBC and United go to PNB, Syndicate to Canara, Allahabad to Indian Bank, Andhra and Corporation to Union. The count falls from 27 (2017) to 12.",focus:["pnb","obc","ubi","canara","syndicate","indianbank","allahabad","union","andhra","corpbank"]},
 {y:2020,cap:"2020 rescues: an SBI-led group saves Yes Bank (March); Lakshmi Vilas Bank is merged into DBS Bank India (November).",focus:["yesbank","sbi","hdfcbank","icicibank","lvb","dbsindia","dbs"]},
 {y:2023,cap:"July 2023: HDFC Ltd merges into HDFC Bank (about $40B), India's largest corporate merger.",focus:["hdfc","hdfcbank","hdfclife"]},
 {y:2026,cap:"2025–26: foreign capital moves in. SMBC becomes Yes Bank's top shareholder, Emirates NBD takes 60% of RBL Bank, MUFG buys 20% of Shriram Finance, and the Cabinet approves selling 60.72% of IDBI Bank to Fairfax.",focus:["smfg","yesbank","enbd","rbl","mufg","shriram","fairfax","idbi","lic","gov_in"]}
]},
{id:"aibets",title:"Big Tech's bets on AI",blurb:"Ten years of acquisitions, mega-rounds and circular deals that tied the AI labs to the chip and cloud giants.",steps:[
 {y:2014,cap:"2014: Google buys London's DeepMind for about $500M.",focus:["alphabet","deepmind"]},
 {y:2019,cap:"2019: Microsoft invests $1B in OpenAI, then a reported $10B in 2023; Khosla is OpenAI's first venture investor.",focus:["microsoft","openai","khosla"]},
 {y:2023,cap:"2023: Amazon and Google back Anthropic; FTX's early Anthropic stake later rescues FTX's creditors.",focus:["amazon","alphabet","anthropic","ftx","menlo"]},
 {y:2025,cap:"2025: Meta buys 49% of Scale AI; SoftBank leads a $40B OpenAI round; Stargate is announced; Nvidia buys into Intel and Nokia; Microsoft and Nvidia invest in Anthropic.",focus:["meta","scale","softbank","openai","stargate","oracle","mgx","nvidia","intel","nokia","anthropic","microsoft"]},
 {y:2026,cap:"2026: consolidation. SpaceX merges with xAI ($250B), lists on Nasdaq and buys Cursor ($60B); Google closes Wiz ($32B); Nvidia agrees to buy Hugging Face.",focus:["spacex","xai","twitter","cursor","alphabet","wiz","nvidia","huggingface","musk"]},
 {y:2026,cap:"2026: the mega-rounds. OpenAI raises $122B at $852B with Amazon, Nvidia and SoftBank; Anthropic raises $65B at $965B. Much of the money flows back to the investors as chip and cloud spending.",focus:["openai","amazon","nvidia","softbank","anthropic","altimeter","gic","coatue","microsoft","alphabet"]}
]},
{id:"oil",title:"From Standard Oil to Big Oil",blurb:"A century of break-ups, nationalisations and megamergers in the oil business.",steps:[
 {y:1911,cap:"1911: the US Supreme Court breaks Standard Oil into 34 companies. Its pieces become Exxon, Mobil, Chevron and Amoco.",focus:["standardoil","exxon","mobil","chevron","amoco"]},
 {y:1914,cap:"1914: Winston Churchill buys 51% of Anglo-Persian Oil (later BP) to secure fuel for the Royal Navy.",focus:["gov_uk","bp"]},
 {y:1938,cap:"1938: Mexico nationalises its foreign oil companies and creates Pemex.",focus:["gov_mx","pemex"]},
 {y:1980,cap:"1973–80: Saudi Arabia buys out Aramco's four American owners. India nationalises Esso and Burmah Shell, creating HPCL and BPCL.",focus:["gov_sa","aramco","chevron","exxon","mobil","texaco","gov_in","hpcl","bpcl"]},
 {y:2001,cap:"1998–2001: the megamergers. BP–Amoco, Exxon–Mobil ($81B), TotalFina–Elf and Chevron–Texaco.",focus:["bp","amoco","exxon","mobil","total","elf","chevron","texaco"]},
 {y:2013,cap:"2013: Rosneft buys TNK-BP for $55B; BP takes 19.75% of Rosneft, which it writes off when it leaves Russia in 2022.",focus:["rosneft","tnkbp","bp","gov_ru","yukos"]},
 {y:2020,cap:"2019–20: Aramco's $29.4B IPO, then the largest ever; it buys 70% of SABIC from PIF. A $15B deal with Reliance falls through.",focus:["aramco","pif","sabic","gov_sa","reliance"]},
 {y:2025,cap:"2024–25: shale consolidation. ExxonMobil buys Pioneer ($59.5B); Chevron wins Hess ($53B) after an arbitration fight with Exxon.",focus:["exxon","pioneer","chevron","hess"]}
]},
{id:"gulf",title:"Gulf money goes global",blurb:"How sovereign funds from Abu Dhabi, Saudi Arabia, Qatar and Kuwait became the world's swing investors.",steps:[
 {y:2008,cap:"2007–08: Gulf funds recapitalise Western banks. ADIA invests in Citigroup, Qatar in Barclays and Credit Suisse, Kuwait in Merrill Lynch and Citi.",focus:["adia","citi","qia","barclays","creditsuisse","kia_fund","merrill"]},
 {y:2009,cap:"2009: Qatar buys 17% of Volkswagen's votes from a cornered Porsche SE.",focus:["qia","vw","porsche_se"]},
 {y:2017,cap:"2016–17: Saudi PIF puts $3.5B into Uber and $45B into SoftBank's Vision Fund, with Mubadala adding $15B.",focus:["pif","uber","svf","softbank","mubadala"]},
 {y:2020,cap:"2020: PIF, Mubadala and ADIA buy into Jio Platforms and Reliance Retail; Aramco buys SABIC from PIF for $69.1B.",focus:["pif","mubadala","adia","jio","rr","reliance","gic","aramco","sabic"]},
 {y:2026,cap:"2025–26: AI and entertainment. MGX backs OpenAI, Anthropic and xAI and takes 15% of TikTok US; PIF takes EA private ($55B); Emirates NBD buys 60% of RBL Bank; ADNOC completes Covestro.",focus:["mgx","openai","anthropic","tiktok_us","pif","ea","enbd","rbl","icd","adnoc","covestro"]}
]},
{id:"tata",title:"Tata goes global, then comes home",blurb:"The Tata group's overseas buying spree, its boardroom war and the return of Air India.",steps:[
 {y:1932,cap:"1932: J.R.D. Tata starts Tata Airlines. In 1953 it is nationalised as Air India.",focus:["tata_sons","air_india","gov_in","tata_trusts"]},
 {y:2000,cap:"2000: Tata Tea buys Tetley for £271M, the first big Indian takeover of a British brand.",focus:["tata_consumer","tetley","tata_sons"]},
 {y:2007,cap:"2007: Tata Steel wins Corus (formerly British Steel) for $12.1B after nine rounds of bidding against Brazil's CSN.",focus:["tata_steel","corus","gov_uk"]},
 {y:2008,cap:"2008: Tata Motors buys Jaguar Land Rover from Ford for $2.3B, in the middle of the financial crisis.",focus:["tata_motors","jlr","ford"]},
 {y:2018,cap:"2016–21: Cyrus Mistry is removed as chairman, setting off a court battle with the Shapoorji Pallonji family (18.4%). Tata Steel buys Bhushan Steel through insolvency (2018).",focus:["tata_trusts","sp_group","tata_sons","tata_steel","bhushan"]},
 {y:2022,cap:"2022: Air India returns to Tata for ₹18,000 crore. Vistara merges into it in 2024 and Singapore Airlines takes 25.1%.",focus:["tata_sons","air_india","vistara","sia","gov_in"]},
 {y:2026,cap:"2025–26: Tata Capital lists (October 2025) and Tata Motors moves to buy Iveco (€3.8B), its largest deal since JLR.",focus:["tata_motors","iveco","exor","tata_capital","tata_sons"]}
]},
{id:"indiastate",title:"India's state: nationalise, then sell",blurb:"From the nationalisations of the 1950s–70s to strategic sales, rescues and the IDBI Bank deal.",steps:[
 {y:1956,cap:"1956: 245 private life insurers are nationalised into LIC.",focus:["lic","gov_in"]},
 {y:1976,cap:"1969–76: banks are nationalised (1969, 1980) and so are foreign oil companies: Esso becomes HPCL, Burmah Shell becomes BPCL.",focus:["gov_in","hpcl","bpcl","sbi","pnb","bob","canara"]},
 {y:1982,cap:"1981–82: the state founds Maruti Udyog with Suzuki as a minority partner. Suzuki takes majority control in 2002.",focus:["maruti","suzuki","gov_in"]},
 {y:2002,cap:"2001–02: the first strategic sales. BALCO and Hindustan Zinc go to Sterlite (Vedanta), VSNL to Tata.",focus:["balco","hzl","vedanta","tata_comm","tata_sons","gov_in"]},
 {y:2018,cap:"2018–19: ONGC buys the government's 51% of HPCL; LIC rescues IDBI Bank by taking 51%.",focus:["ongc","hpcl","lic","idbi","gov_in"]},
 {y:2022,cap:"2022: Air India is sold back to Tata and LIC lists on the stock market.",focus:["air_india","tata_sons","lic","gov_in"]},
 {y:2025,cap:"2023–25: the state as rescuer. It converts Vodafone Idea's dues into a 48.99% stake to keep three private operators in the market.",focus:["vodafone_idea","gov_in","vodafone","birla_fam"]},
 {y:2026,cap:"October 2026: the Cabinet approves selling 60.72% of IDBI Bank to Fairfax for ₹52,878 crore, and Jio Platforms' IPO opens on 21 October.",focus:["idbi","fairfax","lic","gov_in","jio","reliance"]}
]},
{id:"musk",title:"How Musk's companies folded into one",blurb:"From PayPal to a $1.77 trillion SpaceX that now owns xAI, X and Cursor.",steps:[
 {y:2002,cap:"1999–2002: Musk's X.com merges into PayPal, which eBay buys in 2002. He founds SpaceX the same year.",focus:["musk","paypal","ebay","spacex"]},
 {y:2009,cap:"2004–10: Musk leads Tesla's Series A. Daimler (2009) and Toyota (2010) invest when Tesla is short of cash.",focus:["musk","tesla","daimler","toyota"]},
 {y:2016,cap:"2016: Tesla buys SolarCity, founded by Musk's cousins, for $2.6B.",focus:["tesla","solarcity","musk"]},
 {y:2022,cap:"October 2022: Musk buys Twitter for $44B and takes it private.",focus:["musk","twitter"]},
 {y:2025,cap:"March 2025: X is merged into xAI in an all-stock deal valuing X at $33B.",focus:["xai","twitter","musk","mgx","nvidia"]},
 {y:2026,cap:"2026: SpaceX merges with xAI (February), lists on Nasdaq at about $1.77 trillion (June) and buys Cursor for $60B in stock (August).",focus:["spacex","xai","cursor","tesla","musk","alphabet"]}
]},
{id:"votes",title:"Votes, not shares",blurb:"How founders and families keep control of giant companies with a small slice of the equity: dual-class shares, holding companies and foundations.",steps:[
 {y:1956,cap:"1956: Ford goes public, but the founding family keeps class B shares with 40% of the votes. Today those shares are worth about 2% of the company.",focus:["ford_fam","ford"]},
 {y:2012,cap:"Google listed in 2004 with 10-vote shares for its founders, and Facebook copied the model in 2012. Larry Page and Sergey Brin hold about 51% of Alphabet's votes with about 12% of the shares; Mark Zuckerberg about 61% of Meta's with 13%.",focus:["page_brin","alphabet","zuckerberg","meta"]},
 {y:2017,cap:"Brian Roberts' class B shares carry a fixed third of Comcast's votes, however many new shares are issued. John Malone controls about 48% of Liberty Media's votes; Liberty bought Formula 1 in 2017.",focus:["roberts_b","comcast","malone","libertymedia","f1"]},
 {y:2022,cap:"Europe uses holding companies. Since their failed 2008–09 bid for Volkswagen, the Porsche and Piëch families have owned every voting share of Porsche SE, which has 53% of Volkswagen's votes with about 32% of its equity. Audi, Porsche AG, Škoda and Traton sit below.",focus:["porsche_piech","porsche_se","vw","audi","porsche_ag","skoda","traton"]},
 {y:2026,cap:"Foundations do the same. The Carlsberg Foundation holds about 30% of Carlsberg and 76% of its votes; the Wallenberg foundations hold half of Investor AB's votes, and Investor about 22% of Ericsson's.",focus:["carlsberg_found","carlsberg","wallenberg_found","investorab","ericsson"]},
 {y:2026,cap:"Richemont's B shares give Johann Rupert's family about half the votes for a tenth of the equity. At Heineken a chain of majority stakes, from the family's L'Arche Green to Heineken Holding to 50.005% of Heineken N.V., keeps the fourth generation in charge.",focus:["rupert_fam","richemont","decarvalho","heineken_hold","heineken","united_breweries"]}
]},
{id:"foundations",title:"Charities that own companies",blurb:"Some of the world's biggest companies answer to foundations: Tata, Novo Nordisk, Maersk, Lilly, Mastercard and, since 2025, OpenAI.",steps:[
 {y:1937,cap:"1937: the Lilly family puts Eli Lilly shares into the Lilly Endowment. Its stake of about 10% has made it one of the richest foundations in the world as obesity drugs lifted Lilly's value.",focus:["lilly_endow","lilly"]},
 {y:1968,cap:"Tata's founders left most of Tata Sons to charitable trusts, which still own about 66%. That is how charities ultimately control TCS (founded 1968), Tata Steel, Tata Motors and Jaguar Land Rover.",focus:["tata_trusts","tata_sons","tcs","tata_steel","tata_motors","sp_group"]},
 {y:1989,cap:"1989: Novo and Nordisk merge, and the Novo Nordisk Foundation keeps 77% of the votes with 28% of the capital through Novo Holdings, which bought Catalent in 2024.",focus:["novo_found","novo","catalent"]},
 {y:2013,cap:"2013: the Møller family regroups its holdings under A.P. Møller Holding, wholly owned by the foundation A.P. Møller set up in 1953; it has 52.5% of Maersk's votes.",focus:["apm_found","apmh","maersk"]},
 {y:2021,cap:"In Spain the la Caixa foundation owns about 32% of CaixaBank, which absorbed the bailed-out Bankia in 2021; the state's rescue fund kept about 17%. In Germany the Else Kröner-Fresenius foundation is Fresenius's largest owner.",focus:["caixa_found","caixabank","gov_es","ekfs","fresenius"]},
 {y:2026,cap:"The newest example: OpenAI's original non-profit, now the OpenAI Foundation, appoints the board of the for-profit OpenAI Group and owns about 26%, more than any investor except Microsoft. The Mastercard Foundation, created at Mastercard's 2006 IPO, holds about 9%.",focus:["openai_found","openai","microsoft","softbank","mc_found","mastercard"]}
]},
{id:"promoters",title:"India's promoter families",blurb:"Most of India's big private companies still answer to the families that founded them. A tour of the promoters, from Bajaj and Ambani to the newer fortunes.",steps:[
 {y:1945,cap:"1945: Kamalnayan Bajaj starts Bachraj Trading, the forerunner of Bajaj Auto. The Bajaj family still controls Bajaj Auto and, through Bajaj Finserv, Bajaj Finance and the two insurers, which the group has owned outright since Allianz sold out in March 2026.",focus:["bajaj_fam","bajaj_auto","bajaj_finserv","bajaj_finance","bajaj_life","bajaj_general"]},
 {y:1958,cap:"1958: Dhirubhai Ambani starts trading spices and yarn. His family's promoter group owns about half of Reliance Industries, which controls Jio, Reliance Retail and JioStar.",focus:["ambani_fam","reliance","jio","rr","jiostar"]},
 {y:1983,cap:"Founder-led groups of the 1970s and 1980s: Shiv Nadar's family owns about 61% of HCLTech, Dilip Shanghvi's about 54% of Sun Pharma, and Azim Premji's about 73% of Wipro.",focus:["nadar_fam","hcltech","shanghvi","sunpharma","premji","wipro"]},
 {y:2000,cap:"2000: Radhakishan Damani founds DMart and still owns about 75%. Uday Kotak, whose firm became a bank in 2003, keeps about 26% of Kotak Mahindra Bank, the most the RBI allows.",focus:["damani","dmart","kotak_u","kotak"]},
 {y:2022,cap:"Gautam Adani's family controls its listed companies with 60–75% stakes and bought Holcim's Ambuja and ACC in 2022. The Birlas, Burmans, Munjals, Lals and TVS family run their groups with stakes of 35–66%.",focus:["adani_fam","adani_ent","adani_ports","ambuja","birla_fam","grasim","burman","dabur","munjal","hero","lal_fam","eicher","tvs_fam","tvs"]},
 {y:2026,cap:"New money: the Jhunjhunwala family is Akasa Air's largest owner, Falguni Nayar's family holds about half of Nykaa, and PhysicsWallah's founders kept about 72% after its 2025 IPO. Infosys is the exception: its founders own about 14%.",focus:["jhunjhunwala","akasa","nayar","nykaa","pandey_pw","physicswallah","infosys_founders","infosys"]}
]},
{id:"gulf",title:"The Gulf's sovereign machines",blurb:"From Kuwait's 1953 fund to Saudi Arabia's PIF and Abu Dhabi's MGX: how oil states turned revenue into stakes in carmakers, games, AI and power.",steps:[
 {y:1974,cap:"1974: the Kuwait Investment Authority, the world's oldest sovereign fund (its forerunner opened in London in 1953), buys 14% of Daimler-Benz. Abu Dhabi's ADIA follows in 1976.",focus:["gov_kw","kia_fund","daimler","adia","gov_ae"]},
 {y:2009,cap:"2009: Qatar's QIA buys into Volkswagen during the Porsche takeover fight and keeps about 17% of the votes. It also owns half of QNB and stakes in Barclays and Glencore.",focus:["gov_qa","qia","vw","qnb","porsche_se"]},
 {y:2017,cap:"2016–18: Saudi Arabia's PIF puts $3.5B into Uber, $45B into SoftBank's Vision Fund and takes control of Lucid.",focus:["gov_sa","pif","uber","svf","softbank","lucid","aramco"]},
 {y:2023,cap:"PIF builds companies at home (ACWA Power, Ma'aden, NEOM) and a games empire abroad: Savvy Games bought Scopely for $4.9B in 2023.",focus:["pif","acwa","maaden","neom","savvy","scopely"]},
 {y:2024,cap:"Abu Dhabi reorganises: ADQ takes Etihad and TAQA, which owns 43% of Masdar with Mubadala and ADNOC. Mubadala and G42 set up MGX to invest in AI.",focus:["gov_ae","adq","etihad","taqa","masdar","mubadala","adnoc","mgx","g42"]},
 {y:2026,cap:"2026: PIF takes Electronic Arts private in the largest leveraged buyout ever, and MGX holds stakes in OpenAI, Anthropic, Binance and TikTok's US venture.",focus:["pif","ea","mgx","openai","anthropic","binance","tiktok_us"]}
]},
{id:"chaebol",title:"Samsung's chain, Hyundai's loop",blurb:"How Korea's two biggest families control trillion-won groups with single-digit stakes, through chains and circles of cross-holdings.",steps:[
 {y:1969,cap:"Lee Byung-chul founded Samsung in 1938 and Samsung Electronics in 1969. The family has never owned much of Electronics directly.",focus:["lee_fam","samsung","samsung_ct"]},
 {y:1998,cap:"1998: in the Asian financial crisis Hyundai Motor rescues Kia and takes about 34%.",focus:["chung_fam","hyundai","kia"]},
 {y:1999,cap:"Then the loop closes: Kia owns about 17% of the parts maker Hyundai Mobis, Mobis owns about 21% of Hyundai Motor, and Hyundai owns 34% of Kia. The Chung family needs only small direct stakes on top.",focus:["chung_fam","mobis","hyundai","kia"]},
 {y:2021,cap:"Samsung's chain: the Lee family owns about 31% of Samsung C&T, which owns 19% of Samsung Life, which owns 8.5% of Samsung Electronics. After Lee Kun-hee's death the family paid about 12 trillion won in inheritance tax.",focus:["lee_fam","samsung_ct","samsunglife","samsung"]},
 {y:2026,cap:"On the atlas's rules neither Samsung Electronics nor Hyundai Motor has a controlling owner: the Lee block holds about 18.5%, and the Hyundai loop never adds up to 30%. The National Pension Service is a big holder in both.",focus:["samsung","hyundai","koreanps","lee_fam","chung_fam"]}
]},
{id:"latam",title:"Latin America's dynasties",blurb:"Slim, Luksic, Batista, Setubal and the FEMSA families, plus two states that took companies back.",steps:[
 {y:1997,cap:"1997: Walmart takes control of Mexico's Cifra, now Walmex, Mexico's largest retailer (about 70% Walmart).",focus:["walmart","walmex"]},
 {y:2001,cap:"2000–01: Carlos Slim spins America Movil out of Telmex; the family controls about half. Citigroup buys Banamex for $12.5B, then sells 25% to Fernando Chico Pardo in 2025.",focus:["slim","americamovil","citi","banamex"]},
 {y:2010,cap:"2010: FEMSA swaps its beer business for 20% of the Heineken group; it sold out by 2023 to focus on OXXO and Coca-Cola FEMSA, which it controls with The Coca-Cola Company as partner.",focus:["femsa","heineken","kof","coke"]},
 {y:2012,cap:"2012: Argentina seizes 51% of YPF from Repsol, which had bought it in 1999. A US court ordered Argentina to pay $16.1B over the expropriation in 2023.",focus:["gov_ar","ypf","repsol"]},
 {y:2014,cap:"The Luksic family controls Antofagasta and, through CSAV, about 30% of Hapag-Lloyd, which it shares with Klaus-Michael Kühne.",focus:["luksic","antofagasta","csav","hapag","kuehne_kmk"]},
 {y:2026,cap:"In Brazil the Batista family owns about 48% of JBS (the state development bank BNDES about 21%), and the Setubal, Villela and Moreira Salles families control Itaú Unibanco, Latin America's largest bank.",focus:["jf_batista","jbs","bndes","gov_br","itausa","itau","bradesco_found","bradesco"]}
]},
{id:"seasia",title:"South-East Asia's tycoons and Temasek",blurb:"The Salims, Hartonos, Sys and Chearavanonts, Jardine's Indonesian empire and Singapore's state investor.",steps:[
 {y:1974,cap:"1974: Singapore sets up Temasek to hold its state companies. It still owns about 29% of DBS, 53% of Singapore Airlines and stakes that later included Singtel, CapitaLand and PSA.",focus:["gov_sg","temasek","dbs","sia","singtel","capitaland","psa_intl","stengg"]},
 {y:1998,cap:"Sudono Salim built Bank Central Asia from 1957; in the 1998 crisis the state took it over. His son Anthoni kept Indofood, maker of Indomie, through Hong Kong's First Pacific.",focus:["salim","bca","firstpacific","indofood"]},
 {y:2002,cap:"2000–02: Jardine's Cycle & Carriage takes about half of Astra International, and the Hartono brothers of Djarum buy control of BCA, now Indonesia's most valuable bank.",focus:["jardine","jcc","astra","hartono","bca"]},
 {y:2012,cap:"2012: Thailand's Charoen Pokphand Group buys HSBC's 15.6% of China's Ping An for $9.4B.",focus:["cp_group","pingan","hsbc"]},
 {y:2026,cap:"The Sy family controls SM Investments and BDO, the Philippines' largest bank; Vietnam's Pham Nhat Vuong controls Vingroup and VinFast; Indonesia's new fund Danantara holds the state's banks.",focus:["sy_fam","sminv","bdo","pham_vuong","vingroup","vinfast","danantara","bri","mandiri"]}
]},
{id:"deals2526",title:"Take-privates and megadeals, 2025–26",blurb:"The deals that closed in the last two years, and the ones that died.",steps:[
 {y:2025,cap:"2025: Sycamore Partners takes Walgreens private; Synopsys closes Ansys ($35B), HPE closes Juniper after settling with US antitrust officials, and Omnicom absorbs Interpublic.",focus:["sycamore","walgreens","synopsys","ansys","hpe","juniper","omnicom","ipg"]},
 {y:2025,cap:"Europe's banks: Monte dei Paschi takes over Mediobanca, but BBVA's hostile bid for Sabadell fails and UniCredit drops Banco BPM; UniCredit keeps building its Commerzbank stake.",focus:["mps","mediobanca","bbva","sabadell","unicredit","bancobpm","commerzbank","creditagricole"]},
 {y:2026,cap:"January–February 2026: Constellation closes Calpine (about $26.6B) and Palo Alto Networks closes CyberArk ($25B).",focus:["constellation","calpine","paloalto","cyberark"]},
 {y:2026,cap:"June 2026: Vodacom takes 55% of Safaricom, buying 15% from Kenya's government; Vodafone owns about 65% of Vodacom.",focus:["vodafone","vodacom","safaricom","gov_ke"]},
 {y:2026,cap:"The biggest of all: PIF's $55B take-private of Electronic Arts and Skydance's $110B takeover of Warner Bros. Discovery, closed in October 2026.",focus:["pif","ea","skydance","wbd","ellison","paramount"]}
]}
];
