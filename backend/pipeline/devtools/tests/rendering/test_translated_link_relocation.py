import fitz

from retainpdf_pipeline.render.document.link_relocation import relocate_translated_links


def test_reference_link_moves_across_pages_and_preserves_destination(tmp_path):
    source=tmp_path/'source.pdf'
    target=tmp_path/'target.pdf'
    uri='https://example.org/reference/12'
    with fitz.open() as doc:
        doc.new_page(width=400,height=300)
        page=doc.new_page(width=400,height=300)
        page.insert_text((30,70),'Original reference [12]',fontsize=12)
        page.insert_link({'kind':fitz.LINK_URI,'from':page.search_for('[12]')[0],'uri':uri})
        doc.save(source)
    with fitz.open(source) as doc:
        # The final translated reference falls in the first group member.
        doc[0].insert_text((30,160),'Translated reference [12]',fontsize=12)
        doc.save(target)
    common=dict(should_translate=True,continuation_group='cross-page',translated_text='translated')
    pages={0:[dict(common,item_id='head',page_idx=0,bbox=[20,130,300,180])],
           1:[dict(common,item_id='tail',page_idx=1,bbox=[20,40,300,90])]}
    # Remove the old visible anchor as happens during source text cleanup.
    with fitz.open(target) as doc:
        doc[1].add_redact_annot(fitz.Rect(20,40,300,90))
        doc[1].apply_redactions()
        cleaned=tmp_path/'cleaned.pdf'
        doc.save(cleaned)
    # Redactions can remove the link; restore its original source hit area.
    with fitz.open(source) as original, fitz.open(cleaned) as doc:
        if not doc[1].get_links():doc[1].insert_link(original[1].get_links()[0])
        doc.save(target)
    result=relocate_translated_links(target,source,pages)
    assert result['moved']==1 and not result['unresolved']
    with fitz.open(target) as doc:
        links=doc[0].get_links()
        assert len(links)==1 and links[0]['uri']==uri
        assert '12' in doc[0].get_textbox(links[0]['from'])
        assert not doc[1].get_links()
