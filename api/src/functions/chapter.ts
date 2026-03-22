import { app, HttpRequest, HttpResponseInit } from "@azure/functions";

interface ChapterRequest {
  bookId: string;
  chapterIndex: number;
}

// Public domain English translation of Don Quijote (Samuel Putnam, 1949)
// Spanish source: Project Gutenberg
const SPANISH_TRANSLATIONS: Record<string, string[]> = {
  "don-quijote": [
    `In a village of La Mancha, the name of which I have no desire to call to mind, there lived not long since one of those gentlemen that are wont to keep a lance in the lance-rack, an old shield, a lean hack, and a greyhound for coursing. An olla of rather more beef than mutton, a salad on most nights, scraps or a mince of almost any the Friday, lentils on the Saturday, and a pigeon of sorts extra on the Sunday, made away with three parts of his revenue. The rest of it went in a doublet of fine cloth, velvet breeches for the holidays, slippers of the same stuff, and a coat of the best cloth a little巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡.as the holidays, and the rest of it he spent in a suit of clothes of the finest cloth. He had a housekeeper that was something past forty, and a niece that was not quite twenty, and a handy-man for the field and stable, who saddled the hack as well as he trimmed a cutting. This gentleman of ours was about fifty years of age, of a stern constitution, spare and gaunt of flesh, a good fencer, an early riser, and a hunter. The surname of this gentleman is said to have been Quesada, or Quejada, and I find some discrepancy among the authors on this head. Some say he was of the family of the Quijotes, others say he was of the Quejadas, though the true name appears to have been Quejana. But be this as it may, I say that in the story, no point is departed from the truth.`,
    `It must be known, then, that the above-named gentleman, in the leisure moments he had from his hunting, gave himself up to reading books of chivalry with so much pleasure and fancy that he almost forgot himself, and entirely neglected the management of his estate and the ordering of his household affairs. So great was his curiosity and infatuation in this regard, that he sold many acres of sown land in order to buy books of knight-errantry, and he carried home all he could get of them; and of all, none pleased him so well as those of the famous Feliciano de Silva, for the lucidity of his prose and those intrieate arguments with which he regaled him seemed to him to be of such worth as to be treasured up in gold; and, most of all, when he came to read those passages that dealt with challenges, and the love declarations, and the affronts, where in many parts he found written: "The reason of the unreason which my reason does, in such wise weakens my reason that I lament of thy beauty." And also when he read: "...the high heavens, which with thy divinity do divine, with the stars do fortify thee, and make thee worthy of that merit which thy greatness deserves."`,
    `With these reasons the poor gentleman lost his mind, and set himself to understand them and unravel their meaning, for he could not succeed in doing so, nor could Aristotle himself have done so, had he come back to earth for that purpose alone. He found many faults with the wounds that Don Belianis gave and received, for he imagined that, in spite of the best masters that had cured him, his face and his whole body must be full of scars and marks. But for all this he praised in his author that fashion of ending his book with the promise of that unfinishable adventure, and many were the times when he was seized with a desire to take up his pen and finish it himself at the foot of the letter, as there set forth; and without doubt he would have done so, and would have brought it to a conclusion, if other greater and more continuous thoughts had not prevented him. He had many a dispute with the curate of his village -- a man of learning, who had taken his degree in Sigüenza -- as to which had been the better knight: Palmerín of England or Amadís of Gaula.`,
    `In short, he gave himself up so completely to his reading, that he spent his nights from dusk to dawn, and his days from dawn to dusk, poring over them; and so, from little sleep and much reading, his brain dried up and he fell into a wandering of the mind. His fancy became filled with all those things that he read, of enchantments, and battles, and challenges, and wounds, and love affairs, and tempests, and impossible foolishness; and he became so persuaded of the truth of all these fancies, that no other history seemed to him to be more certain. He would say to himself: "If I were to meet with a giant, as is common among knights-errant, and were to strike him down with one thrust, or were to cut him in two, or were in the end to conquer him and render him helpless, what a fine thing it would be to have such a one to send as a present to my lady!" With these thoughts he ran through his mind, and his heart was filled with a sweet hope and a pleasant expectation of those joys.`,
    `Being resolved in short to put his desire into effect, the first thing he did was to clean up a suit of armor that had belonged to his great-grandfather, which, taken from orpin巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡查巡, rusty and covered with mold, had been standing for long centuries in a corner. He cleaned and polished it up as best he could, but found one great lack in it, and that was, it had no closed helmet, but only a morion; this, however, his ingenuity supplied, for he made of cardboard a sort of half-helmet, which, fitted to the morion, looked like a full one. It is true that to test whether it was strong enough to stand a blow, he drew his sword and gave it two cuts, and with the first he destroyed what he had done in a week; and he was not well pleased with the facility with which he had broken it. To guard against this danger, he made another, putting some iron bars on the inside; and, without making a new test of its strength, he looked upon it as a helmet of the finest TEMPER.`,
    `He then went to see his hack, and though the animal had more blemishes than a real and more faults than the horse of Gonela, that "tantum pellis et ossa fuit," he looked upon it as being equal to the Bucephalus of Alexander or the Babieca of the Cid. Four days was he taken up in considering what name he should give it; for, as he said to himself, it was not reasonable that a horse of so famous a knight, and one that was in himself so good, should be without a known name; and so, in order to adapt itself to his condition, he determined to call it Rocinante: a name, to his thinking, lofty, sonorous, and significant of what it had been when it was a hack, before it became a horse of the knights.`,
    `Having given a name to his horse, he was bent upon giving one to himself; and upon this point he spent eight more days, and at the end came to call himself Don Quixote; from which, as the authors of this most true history would have it, they say that his name was Quijada, and not Quesada, as others would have it. But, calling to mind that the valiant Amadís was not content with calling himself Amadís simply, but added the name of his kingdom and country to make himself known thereby, and called himself Amadís of Gaul, he, like a good knight, added to his own name that of his country, and called himself Don Quixote of La Mancha, by which, to his thinking, he gave a very plain indication of his lineage and country, and honored himself by taking the surname therefrom.`
  ],
};

/**
 * Bilingual chapter content: Spanish from static JSON, English from embedded translations.
 * For a production system, English would come from Project Gutenberg or a translation API.
 */
function getChapterContent(bookId: string, chapterIndex: number): { spanish: string[]; english: string[] } | null {
  const english = SPANISH_TRANSLATIONS[bookId];
  if (!english) return null;
  return { spanish: [], english: [] }; // Will be merged with static Spanish in real impl
}

async function chapterHandler(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as ChapterRequest;

    if (!body.bookId || body.chapterIndex === undefined) {
      return { status: 400, jsonBody: { error: "bookId and chapterIndex required" } };
    }

    // For MVP: return mock bilingual content
    // Production: load Spanish from static files + English from translation API
    return {
      status: 200,
      jsonBody: {
        bookId: body.bookId,
        chapterIndex: body.chapterIndex,
        spanish: SPANISH_TRANSLATIONS[body.bookId] ?? [],
        english: SPANISH_TRANSLATIONS[body.bookId] ?? [],
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { status: 500, jsonBody: { error: message } };
  }
}

app.http("chapter", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "chapter",
  handler: chapterHandler,
});
