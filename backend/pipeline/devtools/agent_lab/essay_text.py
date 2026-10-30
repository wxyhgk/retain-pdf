"""人造样例 `sample_essay` 的文字：一篇人文学科期刊文章（虚构的作者、虚构的档案，书名和人名是真的）。

记号：`{fn:键}` 是脚注标记（脚注正文在 `FOOTNOTES`），`<i>…</i>` 是斜体（书名、外文词）。
PyMuPDF 自带的 Times 排不出弯引号和破折号，全文只用 ASCII 标点和 Latin-1 的带音符字母（é è ç ô ü ö ß）。
"""

from __future__ import annotations

TITLE = "Borrowed Time: Reading, Debt, and the Provincial Circulating Library, 1855-1875"
AUTHOR = "Eleanor M. Hartwell"
AFFILIATION = "Department of English, Aldermoor University"
PUBLICATION = "Review of Nineteenth-Century Letters 41.2 (Autumn 2026): 211-218"
RUNNING_AUTHOR = "Eleanor M. Hartwell"
RUNNING_TITLE = "Borrowed Time"
RUNNING_FOOTER = "Review of Nineteenth-Century Letters 41.2 (2026)"

ABSTRACT = (
    "Between 1858 and 1871 a clergyman's daughter in Dorset, Agnes Pellew, kept a reading ledger in which she recorded "
    "not only what she borrowed from the subscription library in Dorchester but what each book cost her in days, fines "
    "and attention. This essay reads that ledger against the commercial machinery of Mudie's Select Library and against "
    "the very different economy of the French <i>cabinet de lecture</i>, and it argues, tentatively, that the "
    "three-volume novel taught its readers to experience reading as a form of borrowed time: an hour owed, an hour "
    "returned, an hour that perhaps never quite belonged to the reader at all."
)
KEYWORDS = "Keywords: circulating libraries; reading ledgers; the three-volume novel; Victorian reading; Second Empire"

EPIGRAPH = (
    "Returned on Thursday, three days beyond the term; the fine I do not regret, for I had not finished being sorry "
    "that it was done."
)
EPIGRAPH_SOURCE = "Agnes Pellew, reading ledger, entry for 14 February 1861"

# 正文：("h", 罗马数字, 标题) / ("p", 文字) / ("quote", 语言, 文字, 说明) / ("figure",) / ("refs", [条目])
BODY = [
    ("h", "I", "A Ledger in Dorchester"),
    (
        "p",
        "It is a plain object, the ledger, and it would be easy to pass over in the reading room of a county record "
        "office, where it sits among account books and parish registers that look very much like it: a quarto volume "
        "bound in brown cloth gone soft at the corners, ruled in red by a stationer's machine, and filled, from the "
        "first of March 1858 to the last days of 1871, in a small upright hand that grows steadily more hurried and, I "
        "think, more candid as the years go by.{fn:ledger} Its owner was Agnes Pellew, the second daughter of the rector "
        "of a parish some eight miles outside Dorchester, and what she set down in its columns was neither a diary nor "
        "a commonplace book, though it borrows something from both, but a record of debts: the title of each volume "
        "she took from the Dorchester Subscription Library,{fn:dsl} the date on which it left the shelf, the date on "
        "which it came back, and, in a fourth column headed simply 'Remarks', whatever she felt obliged to say about "
        "the interval.",
    ),
    (
        "p",
        "I came to the ledger by accident, as one generally does, while looking for something else: a stray reference, "
        "in a local antiquarian's notes, to the young Thomas Hardy, then an architect's apprentice in the town, and to "
        "a circle of friends who were said to have exchanged books and opinions on Sunday afternoons.{fn:hardy} Of "
        "Hardy the ledger has nothing to say, and I have long since stopped regretting it. What it offered instead was "
        "something I had not known to want: an account of reading as it was lived by a single person in a single "
        "provincial town, in the decade when the novel in three volumes reached the height of its commercial authority "
        "and was already, though no one yet said so, beginning to lose it; and an account, moreover, kept in the "
        "language of arrears. 'Kept it four days too long,' she writes beside <i>Adam Bede</i>; 'Not worth "
        "the fine,' beside a novel whose title I shall spare its author's descendants; and beside the third volume of "
        "Mrs. Gaskell's <i>Sylvia's Lovers</i>, which she borrowed in the spring of 1863 and returned, it seems, with "
        "real reluctance, only the words 'I should have liked another week, and could not say what for.'{fn:gaskell}",
    ),
    (
        "p",
        "My argument in what follows is a modest one, and I offer it in the hedged spirit in which the ledger itself "
        "appears to have been kept. It is that the circulating library, which we have usually studied as an "
        "economic institution and sometimes as a censor, was also a way of dividing up time; and that the three-volume "
        "novel, the commodity on which that institution was built, gave its readers a vocabulary of terms, returns and "
        "balances in which to think about the hours they spent with it. It may be that I press the metaphor too hard. "
        "But Agnes Pellew presses it harder than I do, and I have tried to follow where she leads, even when, as in the "
        "pages I take up in section III, she leads across the Channel and into a literature that she could read only "
        "in the company of a dictionary.{fn:french}",
    ),
    ("h", "II", "The Hour and the Fine"),
    (
        "p",
        "To understand what her columns are counting, one has to begin with a fact that is easy to state and strangely "
        "hard to feel: that for most of the nineteenth century a new novel in England was not designed to be bought. It "
        "was designed to be lent. The three-volume format, fixed by the trade at a guinea and a half, put the price of "
        "a new novel well beyond the reach of nearly everyone who wished to read it, and the arrangement suited "
        "publishers, who could count on a few hundred sales to the libraries in advance, and suited the libraries, "
        "which could turn a single purchase into a year of subscriptions. Charles Edward Mudie, who had "
        "begun lending books in London in 1842 and who by the time of Agnes Pellew's first entry was the largest buyer "
        "of fiction in the country, charged a guinea a year for the right to carry one volume at a time out of his "
        "premises,{fn:mudie} and it is a feature of the system that has not, I think, been sufficiently admired that "
        "this made a novel in three parts into something that three people could read at once, each of them standing "
        "at a different place in the story, each of them, if the household was well mannered, forbidden by courtesy "
        "from asking the others what happened next.",
    ),
    (
        "p",
        "The Dorchester library was not Mudie's, but it bought from him, and it kept his rules, or a provincial and "
        "slightly more forgiving version of them. A subscriber might hold a volume for fourteen days, after which the "
        "librarian, a Mr. Hallett whom the ledger mentions with a weary affection,{fn:hallett} charged a penny for "
        "every further day, so that a three-volume novel kept a week too long by a reader who had not quite begun the "
        "third volume cost, in the language of the table, the price of a small loaf. What interests me is not "
        "the sum, which was never large enough to ruin anyone, but the form in which it was presented: a term, a day on "
        "which the term expired, and a small and exactly calculable penalty for a failure to be finished on time. "
        "Reading, in such an arrangement, is something one does within a period that belongs to someone else. It is, "
        "in the plainest sense, borrowed time; and the phrase, which we now use of a life that has outlasted its "
        "expectation, seems to me to recover in the library's rules a more literal meaning than anyone intended it to "
        "have.",
    ),
    (
        "p",
        "Not every subscriber was as scrupulous. The librarian's own copy of the rules, which has survived with its "
        "margins crowded by a succession of pencils, records a standing quarrel with a Dorchester solicitor who "
        "returned his volumes in batches at the end of each quarter and paid his fines with a good grace and a small "
        "speech; and a note in the committee minutes for 1863 proposes, with evident weariness, that the penalty be "
        "doubled for gentlemen and halved for ladies, 'on the ground that the former are less in want of the time and "
        "the latter less in want of the money.'{fn:minutes} The proposal was defeated, but it is not, I think, a "
        "frivolous one. It shows how readily the library's economy of days was translated into an economy of "
        "persons, and how little the committee, for all its talk of useful and entertaining knowledge, doubted that "
        "time was something that some readers had more of than others.",
    ),
    (
        "p",
        "That the novelists of the period were aware of the pressure, or at least of the clock that stood behind it, "
        "is not hard to show, though I would not wish to show it too neatly. Anthony Trollope, whose working method, "
        "set out in the famous chapters of his <i>Autobiography</i>, involved a watch placed on the desk and a quota "
        "of words to be delivered every quarter of an hour, wrote for a public that would receive his work in measured "
        "portions and return it, in due course, to the shelf.{fn:trollope} One might argue that the discipline of the "
        "writer and the discipline of the reader were two halves of the same bargain, and that the novel's famous "
        "length, which later critics have taken for a sign of leisure, was in fact a sign of its opposite: a large sum "
        "of time that had to be spent carefully because it had been lent, and could be recalled. Agnes Pellew does not "
        "say this, naturally. She says, beside a volume of Trollope's <i>Barchester Towers</i>, 'Two evenings, and the "
        "second I stole,' and the word stole, which she underlines once, is the first of several in the ledger that I "
        "have come to hear as a kind of confession.",
    ),
    (
        "p",
        "The room in which such bargains were struck had its own look, and the engraving reproduced in figure 1, "
        "which I owe to the kindness of a private collector, shows it with a clarity that no description of mine can "
        "match: a long table, a lamp, a gentleman asleep over a periodical, two ladies at the counter conferring with "
        "the librarian in what we must suppose are low voices, and on the shelves behind them the uniform bindings that "
        "Mudie's bulk purchases had made so familiar. It is an image of order, and what disturbs the order, if anything "
        "does, is the clock above the door, which the engraver has drawn a little larger than perspective can account "
        "for.{fn:engraving}",
    ),
    ("figure",),
    ("h", "III", "A Cabinet in Rouen"),
    (
        "p",
        "Across the Channel the institution had a different name and, as it turned out, a different temper. The French "
        "<i>cabinet de lecture</i>, which flourished in the provincial towns of the July Monarchy and the Second "
        "Empire, lent by the day, the week, or the single sitting, and it lent not three-volume novels but whatever was "
        "in fashion: the <i>roman-feuilleton</i> cut out of the newspaper, the volume of verse, the pamphlet, the "
        "latest attack on the government.{fn:cabinet} Flaubert, who knew the type well, fills the head of Emma Bovary "
        "with books that reach her from sources of exactly this kind, borrowed, passed from hand to hand, and "
        "returned; and it is not by accident that the passage in <i>Madame Bovary</i> that I find myself rereading "
        "most often is the one in which reading is described as an escape from a duty, an hour stolen from some other "
        "hour that was owed to a husband, a household, a piano teacher who did not exist.{fn:emma} I should be careful "
        "here: Emma's reading is not Agnes Pellew's, and the distance between the Norman doctor's wife and the Dorset "
        "rector's daughter is wide enough that to treat them as sisters would be to flatten both. Yet it is striking "
        "that they share a verb. What each of them does, in the margin of her own life, is steal.",
    ),
    (
        "p",
        "The French reader whom I want to set beside her is a later one, and a better writer, and he has the "
        "advantage of having thought about the matter at length. In 1905, in an essay first printed in a review and "
        "afterwards used as the preface to his translation of Ruskin's <i>Sesame and Lilies</i>, Marcel Proust "
        "remembered the hours of his childhood reading in a sentence that I cannot read without a small shock of "
        "recognition, and that I shall quote at its full length, since it is the kind of sentence that cannot be cut "
        "without losing its breath:",
    ),
    (
        "quote",
        "fr",
        "Il n'y a peut-être pas de jours de notre enfance que nous ayons si pleinement vécus que ceux que nous avons "
        "cru laisser sans les vivre, ceux que nous avons passés avec un livre préféré.",
        "Proust, Sur la lecture (1905)",
    ),
    (
        "p",
        "I translate, with the usual loss: there are perhaps no days of our childhood that we lived so fully as those "
        "we thought we had left unlived, those we spent with a favourite book.{fn:proust} What Proust names, in the "
        "sentence's slow subordinate clauses, is a paradox that the ledger enacts in its own plainer terms. The days "
        "that seem to have been lost, the hours not lived, are the ones that return with the greatest force; and the "
        "reader's sense of having been absent from her own life, which is also a sense of having been elsewhere, is "
        "not a loss to be regretted but a kind of wealth deposited in memory. One might say, with some exaggeration, "
        "that Proust discovers in remembered reading the thing that Agnes Pellew records in the fourth column of her "
        "ledger as a debt. The two accountings are not the same, and I would not collapse them, but they are, I want "
        "to suggest, answers to a single question: what does it cost to spend an afternoon inside someone else's "
        "sentences, and to whom is the cost owed?",
        "first",
    ),
    (
        "p",
        "It is worth pausing over the word spend, which both languages permit and which, once heard, is difficult to "
        "stop hearing. In English one spends time, passes it, loses it; in French one <i>passe du temps</i>, "
        "<i>perd son temps</i>, and also, in the sentence I have just quoted, passes days with a book, as though the "
        "days were a kind of coin that changed hands in the transaction.{fn:spend} Perhaps the most that can be said "
        "is that the nineteenth century, in both countries, found in the circulating library a machine for making this "
        "metaphor visible. Whatever the books themselves were about, the arrangement by which they reached their "
        "readers reminded each of them, every fortnight, that an hour has an owner, and that the owner expects it "
        "back.",
    ),
    (
        "p",
        "There is a danger, in comparisons of this kind, of mistaking a resemblance of vocabulary for a resemblance "
        "of experience, and I should say plainly that the French and English arrangements differed in ways that the "
        "ledger cannot illuminate. The <i>abonnement</i> of the <i>cabinet de lecture</i> was typically paid by the "
        "month and was not tied to a particular number of volumes; the English subscription, by contrast, bound the "
        "reader to a rhythm, since the volume taken out on Monday had to be exchanged, if only for another, before the "
        "fortnight was done.{fn:abonnement} It may be that the rhythm, rather than the price, is what a historian of "
        "reading ought most to attend to. A reader who must return something at the end of a fortnight reads "
        "differently from a reader who may keep it for ever, and differently again from a reader who has never been "
        "told when to stop; and the ledger, which is above all a record of stopping, suggests that Agnes Pellew "
        "understood the difference better than the economists who have since described her.",
    ),
    ("h", "IV", "A German Visitor"),
    (
        "p",
        "The point is sharpened by a witness whom Agnes Pellew cannot have met but whom she may, I think, have read. "
        "In 1864 a German traveller named Luise Brandt, a schoolmistress from Hamburg who spent the better part of a "
        "year in the south of England, published a volume of letters in which the English habit of borrowing novels is "
        "described with the faintly scandalised precision of a visitor who has been asked to pay the fine on someone "
        "else's account.{fn:brandt} The passage that interests me, which I give here in her German and then in my own "
        "English, comes from a letter written at Weymouth, not ten miles from Dorchester:",
    ),
    (
        "quote",
        "de",
        "In England leiht man sich Stunden, wie man sich bei uns Geld leiht: gegen Zinsen, mit einiger Scham und mit "
        "der heimlichen Hoffnung, die Rechnung möge vergessen werden. Der Roman, der in drei Bänden zu uns kommt, "
        "kommt nicht als Buch, sondern als Frist.",
        "Brandt, Briefe aus dem englischen Süden (1865)",
    ),
    (
        "p",
        "In England one borrows hours as we at home borrow money: at interest, with some shame, and with the secret "
        "hope that the account may be forgotten. The novel that comes to us in three volumes comes not as a book but "
        "as a term. The German word that I have rendered 'term' is <i>Frist</i>, and it resists a single English "
        "equivalent: it means a period of grace and a deadline at once, the length of time one is allowed and the point "
        "at which the allowance runs out.{fn:frist} Brandt is not an easy writer to trust, and I would not build too "
        "much on a single paragraph; she is quite capable, elsewhere in the same book, of describing the English as a "
        "nation of readers who never finish anything, a charge that the ledger, which records almost nothing left "
        "unfinished, flatly contradicts.{fn:brandt2} But she has noticed, I think, what the English themselves had "
        "stopped noticing, namely that the circulating library did not sell people books but sold them intervals, and "
        "that the interval, not the book, was the thing paid for.",
        "first",
    ),
    (
        "p",
        "What, then, did it mean to return a novel? The question seems merely administrative until one reads the "
        "entries in which Agnes Pellew does it with visible difficulty. In the winter of 1866, after her father's long "
        "illness and the death, in January, of a younger brother whom she names only once, the ledger grows spare, and "
        "the remarks, which had been so lively in the first years, narrow to a single recurring phrase: 'Returned, "
        "unread.' It occurs eleven times between February and June.{fn:unread} One might argue that these are the "
        "entries of a woman who has been lent, in the most literal sense, more time than she can use, and for whom the "
        "library's term has become not a pressure but a mercy, since it makes the days fall into a shape. I am aware "
        "that this reading is generous, perhaps too generous, and that a more sceptical historian would see in the "
        "phrase nothing more than a bereaved reader's attempt to keep a subscription she could not afford to let "
        "lapse. But it is precisely the generosity of the ledger, its refusal to let a debt be merely a debt, that has "
        "persuaded me to read it as I do.",
    ),
    ("h", "V", "What Is Owed"),
    (
        "p",
        "I said at the outset that Agnes Pellew's entries grow more candid as the years pass, and it is time to say "
        "what I meant. In the early volumes the remarks are those of a polite subscriber: 'Dull but well meant,' 'Very "
        "pretty in the second volume,' 'The heroine too good to be true and the hero too true to be good.' "
        "By the end of the 1860s they have changed, in tone and in length, and several of them run to three or four "
        "lines, crowding the margin and in one case spilling over onto the facing page. Their subject is no longer the "
        "book but the hour: where she read it, who interrupted her, whether the lamp was lit, what was said at tea. The "
        "ledger, one begins to see, has turned from a record of what she borrowed into a record of what she spent, and "
        "the second kind of record is, as every bookkeeper knows, the more truthful one.{fn:turn}",
        "first",
    ),
    (
        "p",
        "Perhaps it is worth asking what the library, with its terms and fines, taught her to see. It taught her, "
        "first, that attention is finite, that an evening given to one thing is an evening withheld from another, and "
        "that the withholding can be measured. It taught her, second, that the pleasure of a book is inseparable from "
        "the knowledge that it must go back; and I cannot help noticing that the entries in which she is happiest are "
        "those in which she has come to the end of a volume on the last day of its term, with nothing owed and, as she "
        "puts it once with evident satisfaction, 'not a penny lost by my own foolishness.' It taught her, third, and "
        "this is the lesson that I find hardest to state without sentimentality, that a thing may be possessed "
        "completely for a short time and then given up without any sense of theft, so that the reader's relation to "
        "the novel resembles, more than anything, the relation of a guest to the house in which she has been very "
        "kindly entertained.{fn:benjamin}",
    ),
    (
        "p",
        "There is one more thing in the ledger that I have not yet mentioned, because I do not know what to make of "
        "it. In the autumn of 1864, as I noted at the beginning, two leaves were cut from the volume, and they were cut "
        "with some care, close to the binding and with a single stroke, as if by someone who knew exactly what was to "
        "be taken away. It is tempting to suppose that they recorded a book, or a reading, that Agnes Pellew did not "
        "wish to have recorded, and one might argue, with the weight of a good deal of Victorian fiction behind the "
        "suggestion, that the library's borrowers were in the habit of lending each other more than the library knew. "
        "But the explanation may be duller. A ledger is a thing that is used for other purposes, and a single leaf "
        "of good ruled paper was worth something in a rectory; and in any case the entries on either side of the gap "
        "are continuous in date, as though the time that the missing pages covered had been no time at all.{fn:leaves}",
    ),
    (
        "p",
        "It would be easy to make of all this a parable about modern attention, and I confess that I have felt the "
        "temptation. We, who are told that our hours are being harvested by devices that never ask for them back, "
        "might be thought to have something to learn from a reader who could name the exact moment at which her "
        "evening ceased to be her own. But the parallel is, I suspect, too flattering to us. The ledger does not "
        "describe a lost paradise of concentration; it describes a woman who reads in the interstices of a household, "
        "between the parish accounts and the sick-room, and who is grateful to the library precisely because it gives "
        "those interstices a name and a limit.{fn:attention} What she has, and what we may envy without being able to "
        "copy, is not leisure but a form: a way of saying, of a given stretch of hours, that they were hers until "
        "Thursday.",
    ),
    (
        "p",
        "None of this is to say that the circulating library was a benign institution. It was a monopoly, in the end, "
        "and an unscrupulous one; it enforced a morality of the drawing-room on novelists who could not afford to "
        "offend it; and when the three-volume novel finally collapsed, in the middle of the 1890s, it collapsed because "
        "the libraries themselves, having squeezed the format as hard as it would go, decided that they no longer "
        "needed it.{fn:collapse} But the ledger reminds us that institutions are also lived in, and that those who "
        "live in them sometimes find, inside the terms that bind them, a use for the terms that their makers never "
        "imagined. Agnes Pellew's last entry, dated the twenty-eighth of December 1871, records not a return at all "
        "but a new loan, from a neighbour, of the first of the eight parts in which <i>Middlemarch</i>{fn:middlemarch} had begun to "
        "appear that month, and beside it, under 'Remarks', she has written one word, which I take to be the whole of "
        "her theory of reading and which I will leave, for want of a better ending, to stand as the last word of this "
        "essay: 'Presently.'{fn:presently}",
    ),
    ("h", None, "Works Cited"),
    (
        "refs",
        [
            "Altick, Richard D. <i>The English Common Reader: A Social History of the Mass Reading Public, 1800-1900</i>. "
            "Chicago: University of Chicago Press, 1957.",
            "Ashby, Rosamund. <i>Daughters of the Parsonage: Girls' Reading in Provincial England</i>. Leeds: Calder Hill "
            "Press, 2014.",
            "Benjamin, Walter. <i>Das Passagen-Werk</i>. Ed. Rolf Tiedemann. 2 vols. Frankfurt am Main: Suhrkamp, 1982.",
            "Brandt, Luise. <i>Briefe aus dem englischen Süden</i>. 2 vols. Hamburg: Grunert, 1865.",
            "Colley, J. W. Notebooks. Dorset History Centre, D/COL/11.",
            "Eliot, George. <i>Adam Bede</i>. 3 vols. Edinburgh: Blackwood, 1859.",
            "Eliot, George. <i>Middlemarch: A Study of Provincial Life</i>. 8 parts. Edinburgh: Blackwood, 1871-72.",
            "Flaubert, Gustave. <i>Madame Bovary: Moeurs de province</i>. Paris: Michel Lévy, 1857.",
            "Gaskell, Elizabeth. <i>Sylvia's Lovers</i>. 3 vols. London: Smith, Elder, 1863.",
            "Griest, Guinevere L. <i>Mudie's Circulating Library and the Victorian Novel</i>. Bloomington: Indiana "
            "University Press, 1970.",
            "Hartwell, Eleanor M. 'Dictionary and Daughter: French in the Parsonage, 1840-1880.' <i>Review of "
            "Nineteenth-Century Letters</i> 36.1 (2021): 55-79.",
            "Lyons, Martyn. <i>Reading Culture and Writing Practices in Nineteenth-Century France</i>. Toronto: University "
            "of Toronto Press, 2008.",
            "Pellew, Agnes. Reading ledger, 1858-1871. Dorset History Centre, D/PEL/4.",
            "Proust, Marcel. 'Sur la lecture.' <i>La Renaissance latine</i>, 15 June 1905. Rpt. as 'Journées de lecture' "
            "in <i>Pastiches et mélanges</i>. Paris: Gallimard, 1919.",
            "Trollope, Anthony. <i>An Autobiography</i>. 2 vols. Edinburgh: Blackwood, 1883.",
            "Trollope, Anthony. <i>Barchester Towers</i>. 3 vols. London: Longman, 1857.",
        ],
    ),
]

FIGURE_CAPTION = (
    "The subscribers' reading room of a provincial circulating library. Wood engraving after an unsigned drawing, "
    "c. 1862. Private collection."
)

FOOTNOTES = {
    "ledger": (
        "Dorset History Centre, D/PEL/4 (hereafter 'Ledger'). The volume was rebound, probably in the 1930s, and two "
        "leaves between the entries for September 1864 and January 1865 have been cut out with a blade; I have found no "
        "trace of them, and the accession file describes the ledger only as 'a library book-list, with notes'. I am "
        "grateful to the staff of the search room for allowing me to consult it in its fragile state."
    ),
    "dsl": (
        "The Dorchester Subscription Library was founded in 1819 and occupied rooms above a corn merchant's in South "
        "Street until its books were dispersed in 1913; printed catalogues for 1856 and 1869 survive in the same "
        "repository (D/DSL/2-3). On provincial subscription libraries in general see Ashby, <i>Daughters of the "
        "Parsonage</i>, 40-61."
    ),
    "hardy": (
        "The antiquarian was a Mr. J. W. Colley, whose notebooks (D/COL/11) are mostly concerned with barrows and the "
        "repair of church bells. Hardy's apprenticeship to the Dorchester architect John Hicks began in 1856; whether "
        "he knew the Pellews I have not been able to establish."
    ),
    "gaskell": (
        "Ledger, entries for 20 June 1859 (George Eliot's <i>Adam Bede</i>, which had appeared in February of that year "
        "in three volumes from Blackwood; the library bought four copies, a number that tells us something about its "
        "reputation in the county) and 9 April 1863 (<i>Sylvia's Lovers</i>, three volumes, 1863). Quotations from the "
        "Ledger follow the manuscript, with abbreviations expanded and the occasional ampersand silently normalised. "
        "The hand in the second entry is noticeably larger than in those around it, which may mean only that the "
        "lamp was poor."
    ),
    "french": (
        "Rosamund Ashby, <i>Daughters of the Parsonage: Girls' Reading in Provincial England</i> (Leeds: Calder Hill "
        "Press, 2014), 88-112, on the position of French in the reading of clergymen's daughters, who were confident "
        "enough to borrow and, as a rule, not confident enough to say so aloud; and Eleanor M. Hartwell, 'Dictionary "
        "and Daughter: French in the Parsonage, 1840-1880,' <i>Review of Nineteenth-Century Letters</i> 36.1 (2021): "
        "55-79, and the sources cited there."
    ),
    "mudie": (
        "A guinea and a half was thirty-one shillings and sixpence, the price at which most new three-volume novels "
        "were issued from the 1830s until the 1890s. For the standard accounts see Richard D. Altick, <i>The English "
        "Common Reader</i> (Chicago: University of Chicago Press, 1957), especially the chapters on the libraries, and "
        "Guinevere L. Griest, <i>Mudie's Circulating Library and the Victorian Novel</i> (Bloomington: Indiana "
        "University Press, 1970). Mudie's subscription was a guinea for one volume at a time and two guineas for more; "
        "he also supplied boxes "
        "of books to country subscribers and to provincial libraries, which is how a good many volumes reached Dorset. "
        "His purchases were so large that publishers are said to have gauged the print run of a new novel by his "
        "order. See Griest, <i>Mudie's Circulating Library</i>, passim."
    ),
    "hallett": (
        "Ledger, passim; the librarian is named in the printed rules of 1856 as 'Mr. T. Hallett, Librarian and "
        "Secretary'. In the entry for 3 November 1862 she thanks him, with some irony, 'for his patience with my "
        "arrears'. A penny a day was the common provincial rate, though some libraries charged twopence for novels in "
        "demand. Hallett's salary, according to the committee's accounts for 1860, was twelve pounds a year with the "
        "use of two rooms, out of which he was expected to pay for coals; he seems to have supplemented it by binding "
        "books for subscribers at sixpence a volume, a trade that may account for the evident wear on the Dorchester "
        "copies and for the ledger's habit of recording the condition in which a volume came back. He died in office "
        "in 1868, and the entry in which Agnes Pellew records the return of the last book she borrowed from him is "
        "the only one in the ledger that is written in a different ink."
    ),
    "engraving": (
        "The engraving, which is signed with an illegible monogram, appeared in a provincial illustrated weekly about "
        "1862 and was reprinted several times. The setting is probably a library in a market town, though not, as has "
        "been claimed, Dorchester: the windows and the chimneypiece do not match the corn merchant's premises as they "
        "were photographed in 1890."
    ),
    "minutes": (
        "Dorset History Centre, D/DSL/1, committee minutes, 14 January 1863. The proposal is moved by a Dr. Fownes "
        "and seconded, in a different hand, by a person whose name has since been scratched out. The solicitor, who "
        "appears in the ledger as 'Mr. B.', is not named in the minutes at all."
    ),
    "trollope": (
        "Anthony Trollope, <i>An Autobiography</i> (1883). The account of his habit of writing two hundred and fifty "
        "words every quarter of an hour, with a watch before him, has been repeated so often that one forgets how "
        "strange it must have sounded to those who first read it, and how well, in another sense, it suited the "
        "clockwork of the libraries."
    ),
    "cabinet": (
        "On the French reading rooms see Martyn Lyons, <i>Reading Culture and Writing Practices in Nineteenth-Century "
        "France</i> (Toronto: University of Toronto Press, 2008); the <i>cabinets de lecture</i> were often attached to "
        "a bookshop, a printer's or a tobacconist's, and lent by the sitting as readily as by the volume."
    ),
    "emma": (
        "Gustave Flaubert, <i>Madame Bovary</i> (1857), part one, chapter 6, where the novels reach the convent from "
        "the old maid who comes each month to mend the linen. Flaubert's own bitterness about commercial reading is "
        "better documented in his letters than in the novel, and I have not tried to adjudicate between them here."
    ),
    "proust": (
        "Marcel Proust, 'Sur la lecture' (1905), later the preface to <i>Sésame et les lys</i> (1906), his version of "
        "Ruskin's <i>Sesame and Lilies</i>; the essay was reprinted in <i>Pastiches et mélanges</i> (1919) as 'Journées "
        "de lecture'. The translation, like the others in this essay, is my own."
    ),
    "abonnement": (
        "I am here following Lyons on the monthly <i>abonnement</i>; the evidence for English practice is the printed "
        "rules of the Dorchester library and of Mudie's. Neither, as far as I know, was ever compared with its French "
        "counterpart by a contemporary, though Brandt comes close (section IV)."
    ),
    "spend": (
        "German speaks of <i>Zeit verbringen</i>, literally to 'bring through' a time, a figure of carrying rather "
        "than of payment; it is English and French that think in coin."
    ),
    "brandt": (
        "Luise Brandt, <i>Briefe aus dem englischen Süden</i> (Hamburg: Grunert, 1865), 2:117. Brandt (1821-1889) "
        "taught at a girls' school in Hamburg and travelled in England in 1863-64 on a small legacy; she is otherwise "
        "remembered, if at all, for a manual of domestic economy."
    ),
    "frist": (
        "The word is old; Grimm's <i>Deutsches Wörterbuch</i> gives it the sense both of a time set and of a time "
        "allowed. I owe the observation about its double edge to Katrin Weiler."
    ),
    "brandt2": (
        "She complains, in the same volume (2:203), that the English will 'begin anything and finish nothing'; the "
        "ledger, which records some four hundred volumes read to the end, does not bear her out."
    ),
    "unread": (
        "Ledger, entries from 3 February to 22 June 1866. The brother, Edmund, died at Torquay, where he had been sent "
        "for his lungs; the parish register gives the date as 11 January. The ledger names him once, on a flyleaf: "
        "'E., who read Scott aloud.' Whether the unread books were chosen for the sake of the returning, or returned "
        "for the sake of having been chosen, is a question the entries cannot settle, and I have thought it better to "
        "leave it open than to settle it by an effort of sympathy that the evidence does not warrant."
    ),
    "turn": (
        "Ledger, 1858-60, passim; the remark on the heroine is written beside a novel that I have been unable to "
        "identify, its title abbreviated beyond recovery. The change is gradual, but one can date its beginning with some confidence to the autumn of 1867, when the "
        "column headed 'Remarks' is, for the first time, given a second line at the bottom of the page. After that "
        "date few entries are shorter than two. Whether the decision to write at greater length was a choice or a mere "
        "habit of leisure I cannot say."
    ),
    "benjamin": (
        "Compare Walter Benjamin's essay on his own library, 'Ich packe meine Bibliothek aus' (1931), and the notes on "
        "collecting in <i>Das Passagen-Werk</i>, where possession and memory are treated as two sides of a single "
        "passion. The ledger's guest, who owns nothing, is in some ways the opposite figure: a collector without a "
        "collection."
    ),
    "leaves": (
        "Ledger, between the entries for 28 September 1864 and 6 January 1865. The stubs show no writing, and the "
        "two leaves are of the same paper as the rest, so that the loss cannot be explained by any change of "
        "stationer; for the surviving evidence about the volume's later ownership, which is thin, see the accession "
        "file at the Dorset History Centre, which records its purchase from a bookseller in Bridport in 1936."
    ),
    "attention": (
        "The point owes something to a remark by Rosamund Ashby, in correspondence, that the parsonage reader 'read in "
        "the margins of a house that had no margins'."
    ),
    "collapse": (
        "The two largest libraries, Mudie's and W. H. Smith's, announced in 1894 that they would buy no more "
        "three-volume novels at the old price; within three years the format had all but vanished. See Griest, "
        "<i>Mudie's Circulating Library</i>, on the events of 1894-97."
    ),
    "middlemarch": (
        "George Eliot, <i>Middlemarch: A Study of Provincial Life</i> (Edinburgh: Blackwood, 1871-72), issued in eight "
        "parts between December 1871 and December 1872, which is to say that the first part was an invitation to a "
        "long wait. The "
        "fact that it was sold in parts, and borrowed by the part from neighbours who could afford to buy them, is a "
        "reminder that the three-volume novel was never the only form in which the Victorians read."
    ),
    "presently": (
        "Ledger, 28 December 1871, the last entry. The remaining leaves of the volume, some forty of them, are ruled "
        "but empty. I have sometimes thought of them as the most eloquent part of the book."
    ),
}
